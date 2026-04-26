import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Step1Patient,
  Step2Clinical,
  Step3ServiceTest,
  Step4GeneticResults,
  Step5ServiceType,
  Step6Note,
} from "@/components/specify/create-specify-steps";
import { useAuth } from "@/contexts/AuthContext";
import { usePrefetchProvinces } from "@/hooks/useAddressQueries";
import { presentFeedbackError, presentFeedbackSuccess } from "@/lib/feedbackModal";
import {
  specifyFormDefaultValues,
  specifyFormSchema,
  type SpecifyFormData,
} from "@/lib/schemas/specify-form-schema";
import {
  applyDiseasePayloadToValues,
  applyEmbryoPayloadToValues,
  applyReproductionPayloadToValues,
  mapSpecifyToFormValues,
} from "@/lib/specify/map-specify-to-form";
import { getApiResponseData, getApiResponseSingle } from "@/lib/types/api-types";
import { diseaseService } from "@/services/diseaseService";
import { doctorService, type DoctorResponse } from "@/services/doctorService";
import { embryoService } from "@/services/embryoService";
import { genomeTestService, type GenomeTestResponse } from "@/services/genomeTestService";
import { hospitalService, type HospitalResponse } from "@/services/hospitalService";
import { patientClinicalService } from "@/services/patientClinicalService";
import { patientService } from "@/services/patientService";
import { reproductionService } from "@/services/reproductionService";
import { serviceEntityService, type ServiceEntityResponse } from "@/services/serviceEntityService";
import {
  specifyVoteTestService,
  type SpecifyVoteTestRequest,
  type SpecifyVoteTestResponse,
} from "@/services/specifyVoteTestService";

const TOTAL_STEPS = 6;
const STEP_TITLES = [
  "Thông tin bệnh nhân",
  "Thông tin lâm sàng",
  "Loại dịch vụ & Xét nghiệm",
  "Thông tin nhóm xét nghiệm",
  "Kết quả xét nghiệm di truyền",
  "Ghi chú",
];

function Stepper({
  totalSteps,
  currentStep,
  onStepPress,
}: {
  totalSteps: number;
  currentStep: number;
  onStepPress?: (step: number) => void;
}) {
  return (
    <View className="mt-4">
      <View className="absolute left-0 right-0 top-[14px] h-[2px] bg-slate-200" />
      <View
        className="absolute left-0 top-[14px] h-[2px] bg-sky-600"
        style={{
          width:
            totalSteps <= 1 ? "0%" : `${((currentStep - 1) / (totalSteps - 1)) * 100}%`,
        }}
      />
      <View className="flex-row items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const circleBg = isDone ? "bg-sky-600" : "bg-white";
          const circleBorder = isDone
            ? "border-sky-600"
            : isActive
              ? "border-sky-600"
              : "border-slate-300";
          const textColor = isDone ? "text-white" : isActive ? "text-sky-700" : "text-slate-500";

          return (
            <TouchableOpacity
              key={stepNum}
              activeOpacity={onStepPress && isDone ? 0.7 : 1}
              onPress={() => onStepPress && isDone && onStepPress(stepNum)}
              disabled={!onStepPress || !isDone}
              className="items-center"
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center border-2 ${circleBg} ${circleBorder}`}
              >
                {isDone ? (
                  <Check size={16} color="#fff" strokeWidth={3} />
                ) : (
                  <Text className={`text-[12px] font-extrabold ${textColor}`}>{stepNum}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function SpecifyEditScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { specifyId } = useLocalSearchParams<{ specifyId: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  usePrefetchProvinces();

  const isStaffEdit = pathname?.includes("staff") ?? false;
  const afterSaveRoute = isStaffEdit ? "/staff/prescription-slips" : "/customer/specifies";

  const [currentStep, setCurrentStep] = useState(1);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [currentStep]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const methods = useForm<SpecifyFormData>({
    resolver: zodResolver(specifyFormSchema),
    mode: "onTouched",
    defaultValues: specifyFormDefaultValues,
  });

  const { getValues, setValue, reset, trigger } = methods;

  const { data: specifyResponse, isLoading: loadingSpecify } = useQuery({
    queryKey: ["specify", specifyId],
    queryFn: () => specifyVoteTestService.getById(specifyId!),
    enabled: !!specifyId,
    retry: false,
    staleTime: 60 * 1000,
  });

  const specify = getApiResponseSingle<SpecifyVoteTestResponse>(specifyResponse);


  const hospitalId = useMemo(() => {
    const fromUser = user?.hospitalId != null ? String(user.hospitalId) : "";
    if (fromUser) return fromUser;
    if (!specify) return "";
    const hid = specify.hospitalId ?? specify.hospital?.hospitalId;
    return hid != null && hid !== "" ? String(hid) : "";
  }, [user?.hospitalId, specify]);

  useEffect(() => {
    if (!specify || loadingSpecify) return;
    let cancelled = false;

    (async () => {
      const formValues = mapSpecifyToFormValues(specify);
      const st = String(specify.serviceType ?? "").toLowerCase();
      const crlNtEmpty =
        !String(formValues.headRumpLength ?? "").trim() &&
        !String(formValues.neckLength ?? "").trim();
      const shouldLoadReproRow =
        st === "reproduction" &&
        !!specify.serviceID &&
        (!specify.reproductionService || crlNtEmpty);

      if (shouldLoadReproRow) {
        try {
          const res = await reproductionService.getByServiceId(specify.serviceID!);
          const rows = getApiResponseData(res);
          const row = rows[0];
          if (row && !cancelled) applyReproductionPayloadToValues(formValues, row);
        } catch {

        }
      }

      const shouldLoadEmbryoRow =
        st === "embryo" &&
        !!specify.serviceID &&
        (!specify.embryoService || !String(formValues.embryoServiceId ?? "").trim());

      if (shouldLoadEmbryoRow) {
        try {
          const res = await embryoService.getByServiceId(specify.serviceID!);
          const rows = getApiResponseData(res);
          const row = rows[0];
          if (row && !cancelled) applyEmbryoPayloadToValues(formValues, row);
        } catch {

        }
      }

      const shouldLoadDiseaseRow =
        st === "disease" &&
        !!specify.serviceID &&
        (!specify.diseaseService || !String(formValues.diseaseServiceId ?? "").trim());

      if (shouldLoadDiseaseRow) {
        try {
          const res = await diseaseService.getByServiceId(specify.serviceID!);
          const rows = getApiResponseData(res);
          const row = rows[0];
          if (row && !cancelled) applyDiseasePayloadToValues(formValues, row);
        } catch {

        }
      }

      if (!cancelled) reset({ ...specifyFormDefaultValues, ...formValues });
    })();

    return () => {
      cancelled = true;
    };
  }, [specify, loadingSpecify, reset]);

  useEffect(() => {
    if (hospitalId) setValue("hospitalId", hospitalId);
  }, [hospitalId, setValue]);

  const { data: servicesResponse } = useQuery({
    queryKey: ["services"],
    queryFn: () => serviceEntityService.getAll(),
  });

  const { data: doctorByUserResponse } = useQuery({
    queryKey: ["doctor-by-user", user?.id],
    queryFn: () => doctorService.getByUserId(user!.id),
    enabled: !!user?.id,
  });

  const { data: doctorsByHospitalResponse } = useQuery({
    queryKey: ["doctors-by-hospital", hospitalId],
    queryFn: () => doctorService.getByHospitalId(hospitalId),
    enabled: !!hospitalId,
  });

  const { data: hospitalsResponse } = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => hospitalService.getAll(),
  });

  const serviceId = methods.watch("serviceId");
  const { data: genomeTestsResponse } = useQuery({
    queryKey: ["genome-tests", serviceId],
    queryFn: () => genomeTestService.getByServiceId(serviceId!),
    enabled: !!serviceId,
  });

  const services = useMemo(
    () => getApiResponseData<ServiceEntityResponse>(servicesResponse) || [],
    [servicesResponse]
  );
  const currentUserDoctor = getApiResponseSingle<DoctorResponse>(doctorByUserResponse);
  const doctorsByHospital = getApiResponseData<DoctorResponse>(doctorsByHospitalResponse) || [];
  const doctors = useMemo(() => {
    if (currentUserDoctor) return [currentUserDoctor];
    return doctorsByHospital.length > 0 ? doctorsByHospital : [];
  }, [currentUserDoctor, doctorsByHospital]);
  const hospitals = useMemo(
    () => getApiResponseData<HospitalResponse>(hospitalsResponse) || [],
    [hospitalsResponse]
  );
  const genomeTests = useMemo(
    () => getApiResponseData<GenomeTestResponse>(genomeTestsResponse) || [],
    [genomeTestsResponse]
  );

  const stackScreenOptions = useMemo(() => ({ headerShown: false }), []);
  useEffect(() => {
    if (serviceId && services.length > 0) {
      const svc = services.find((s: any) => s.serviceId === serviceId);
      if (svc) {
        const name = (svc.name || "").toLowerCase();
        if (name.includes("sinh sản") || name.includes("reproduction"))
          setValue("serviceType", "reproduction");
        else if (name.includes("phôi") || name.includes("embryo"))
          setValue("serviceType", "embryo");
        else if (name.includes("bệnh lý") || name.includes("disease"))
          setValue("serviceType", "disease");
      }
    }
  }, [serviceId, services, setValue]);

  const getServiceId = (): string => {
    const serviceType = getValues("serviceType");
    const svc = services.find(
      (s: any) =>
        s.serviceId === (serviceType || "").toLowerCase() ||
        (s.name || "").toLowerCase().includes((serviceType || "").toLowerCase())
    );
    return svc?.serviceId || getValues("serviceId") || serviceType || "";
  };

  const updateSpecifyMutation = useMutation({
    mutationFn: async (formData: SpecifyFormData) => {
      const patientId = formData.selectedPatientId!;

      await patientService.update(patientId, {
        patientId,
        patientName: formData.patientName!,
        patientPhone: formData.patientPhone!,
        patientDob: formData.patientDob ? new Date(formData.patientDob).toISOString() : undefined,
        gender: formData.patientGender || undefined,
        patientEmail: formData.patientEmail?.trim() || undefined,
        patientJob: formData.patientJob?.trim() || undefined,
        patientContactName: formData.patientContactName?.trim() || undefined,
        patientContactPhone: formData.patientContactPhone?.trim() || undefined,
        patientAddress: formData.patientAddress?.trim() || undefined,
      });

      const clinicalRequest = {
        patientId,
        patientHeight:
          formData.patientHeight != null ? Number(formData.patientHeight) : undefined,
        patientWeight:
          formData.patientWeight != null ? Number(formData.patientWeight) : undefined,
        patientHistory: formData.patientHistory?.trim() || undefined,
        familyHistory: formData.familyHistory?.trim() || undefined,
        medicalHistory: formData.medicalHistory?.trim() || undefined,
        medicalUsing: formData.medicalUsing
          ? formData.medicalUsing.split(",").map((m) => m.trim()).filter(Boolean)
          : undefined,
        chronicDisease: formData.chronicDisease?.trim() || undefined,
        acuteDisease: formData.acuteDisease?.trim() || undefined,
        toxicExposure: formData.toxicExposure?.trim() || undefined,
      };

      if (formData.patientClinicalId) {
        await patientClinicalService.update(formData.patientClinicalId, clinicalRequest);
      } else {
        await patientClinicalService.create(clinicalRequest);
      }

      const svcId = getServiceId() || formData.serviceId;
      if (!svcId) throw new Error("Vui lòng chọn loại dịch vụ");

      if (formData.serviceType === "reproduction") {
        const reproductionRequest = {
          serviceId: svcId,
          patientId,
          fetusesNumber: formData.fetusesNumber ? parseInt(formData.fetusesNumber) : undefined,
          fetusesWeek: formData.fetusesWeek ? parseInt(formData.fetusesWeek) : undefined,
          fetusesDay: formData.fetusesDay ? parseInt(formData.fetusesDay) : undefined,
          ultrasoundDay: formData.ultrasoundDay || undefined,
          headRumpLength: formData.headRumpLength ? parseFloat(formData.headRumpLength) : undefined,
          neckLength: formData.neckLength ? parseFloat(formData.neckLength) : undefined,
          combinedTestResult: formData.combinedTestResult?.trim() || undefined,
          ultrasoundResult: formData.ultrasoundResult?.trim() || undefined,
        };
        if (formData.reproductionServiceId) {
          await reproductionService.update(formData.reproductionServiceId, reproductionRequest);
        } else {
          await reproductionService.create(reproductionRequest);
        }
      } else if (formData.serviceType === "embryo") {
        const embryoRequest = {
          serviceId: svcId,
          patientId,
          biospy: formData.biospy?.trim() || undefined,
          biospyDate: formData.biospyDate || undefined,
          cellContainingSolution: formData.cellContainingSolution?.trim() || undefined,
          embryoCreate: formData.embryoCreate ? parseInt(formData.embryoCreate) : undefined,
          embryoStatus: formData.embryoStatus?.trim() || undefined,
          morphologicalAssessment: formData.morphologicalAssessment?.trim() || undefined,
          cellNucleus: formData.cellNucleus === true,
          negativeControl: formData.negativeControl?.trim() || undefined,
        };
        if (formData.embryoServiceId) {
          await embryoService.update(formData.embryoServiceId, embryoRequest);
        } else {
          await embryoService.create(embryoRequest);
        }
      } else if (formData.serviceType === "disease") {
        const diseaseRequest = {
          serviceId: svcId,
          patientId,
          symptom: formData.symptom?.trim() || undefined,
          diagnose: formData.diagnose?.trim() || undefined,
          diagnoseImage: formData.diagnoseImage?.trim() || undefined,
          testRelated: formData.testRelated?.trim() || undefined,
          treatmentMethods: formData.treatmentMethods?.trim() || undefined,
          treatmentTimeDay: formData.treatmentTimeDay ? parseInt(formData.treatmentTimeDay) : undefined,
          drugResistance: formData.drugResistance?.trim() || undefined,
          relapse: formData.relapse?.trim() || undefined,
        };
        if (formData.diseaseServiceId) {
          await diseaseService.update(formData.diseaseServiceId, diseaseRequest);
        } else {
          await diseaseService.create(diseaseRequest);
        }
      }

      const specifyReq: SpecifyVoteTestRequest = {
        serviceId: formData.serviceId || svcId,
        patientId,
        genomeTestId: formData.genomeTestId!,
        hospitalId: formData.hospitalId || hospitalId || undefined,
        doctorId: formData.doctorId?.trim() || undefined,
        samplingSite: formData.samplingSite?.trim() || undefined,
        sampleCollectDate: formData.sampleCollectDate
          ? new Date(formData.sampleCollectDate).toISOString()
          : undefined,
        embryoNumber:
          formData.embryoNumber != null && formData.embryoNumber !== ""
            ? Number(formData.embryoNumber)
            : undefined,
        geneticTestResults: formData.geneticTestResults?.trim() || undefined,
        geneticTestResultsRelationship:
          formData.geneticTestResultsRelationship?.trim() || undefined,
        specifyNote: formData.specifyNote?.trim() || undefined,
        sendEmailPatient: formData.sendEmailPatient ?? false,
      };

      const specifyRes = await specifyVoteTestService.update(specifyId!, specifyReq);
      if (!specifyRes.success) {
        throw new Error(specifyRes.error || "Không thể cập nhật phiếu xét nghiệm");
      }
      return specifyId!;
    },
    onError: (error: any) => {
      presentFeedbackError({
        title: "Lỗi cập nhật",
        message: error?.message || "Không thể cập nhật phiếu xét nghiệm. Vui lòng thử lại.",
      });
    },
  });

  const validateStep = async (step: number): Promise<boolean> => {
    const data = getValues();

    switch (step) {
      case 1: {
        const fields =
          data.isNewPatient === true
            ? (["patientPhone", "patientName", "patientAddress"] as const)
            : (["patientPhone", "patientName"] as const);
        const valid = await trigger([...fields]);
        if (!valid) {
          const errors = methods.formState.errors;
          const firstError =
            errors.patientPhone?.message ||
            errors.patientName?.message ||
            errors.patientAddress?.message ||
            "Vui lòng kiểm tra lại thông tin bệnh nhân";
          presentFeedbackError({ title: "Lỗi", message: String(firstError) });
          return false;
        }
        if (!data.selectedPatientId && !data.isNewPatient) {
          presentFeedbackError({
            title: "Lỗi",
            message: "Vui lòng chọn bệnh nhân hoặc thêm bệnh nhân mới",
          });
          return false;
        }
        if (data.isNewPatient) {
          if (!(data.patientAddress || "").trim()) {
            presentFeedbackError({ title: "Lỗi", message: "Vui lòng nhập / chọn địa chỉ" });
            return false;
          }
          const parts = (data.patientAddress || "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          if (parts.length < 3) {
            presentFeedbackError({
              title: "Lỗi",
              message: "Vui lòng chọn đủ tỉnh/thành phố, quận/huyện và phường/xã",
            });
            return false;
          }
        }
        return true;
      }
      case 2: {
        const fields = [
          "patientHeight",
          "patientWeight",
          "patientHistory",
          "familyHistory",
          "medicalHistory",
          "medicalUsing",
          "chronicDisease",
          "acuteDisease",
          "toxicExposure",
        ] as const;
        const valid = await trigger(fields);
        if (!valid) {
          const errors = methods.formState.errors;
          const firstError =
            errors.patientHeight?.message ||
            errors.patientWeight?.message ||
            errors.patientHistory?.message ||
            errors.familyHistory?.message ||
            errors.medicalHistory?.message ||
            errors.medicalUsing?.message ||
            errors.chronicDisease?.message ||
            errors.acuteDisease?.message ||
            errors.toxicExposure?.message ||
            "Vui lòng kiểm tra lại thông tin lâm sàng";
          presentFeedbackError({ title: "Lỗi", message: String(firstError) });
          return false;
        }
        return true;
      }
      case 3:
        if (!data.serviceId) {
          presentFeedbackError({ title: "Lỗi", message: "Vui lòng chọn loại dịch vụ" });
          return false;
        }
        if (!data.genomeTestId) {
          presentFeedbackError({ title: "Lỗi", message: "Vui lòng chọn xét nghiệm" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!(await validateStep(currentStep))) return;

    if (currentStep === TOTAL_STEPS) {
      setIsSubmitting(true);
      try {
        const formData = getValues();
        await updateSpecifyMutation.mutateAsync(formData);
        queryClient.invalidateQueries({ queryKey: ["customer-specifies"] });
        queryClient.invalidateQueries({ queryKey: ["specify-vote-tests"] });
        queryClient.invalidateQueries({ queryKey: ["specify", specifyId] });
        queryClient.invalidateQueries({ queryKey: ["specify-vote-test"] });
        presentFeedbackSuccess({
          title: "Cập nhật thành công",
          message: `Phiếu xét nghiệm ${specifyId || ""} đã được cập nhật thành công.`,
          onAfterClose: () => router.replace(afterSaveRoute as any),
        });
      } catch {
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep((p) => Math.min(p + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else {
      setCurrentStep((p) => Math.max(p - 1, 1));
    }
  };

  const handlePatientSelect = async (patientId: string) => {
    try {
      const clinicalRes = await patientClinicalService.getByPatientId(patientId);
      const clinical = clinicalRes.data;
      if (clinical) {
        setValue("patientClinicalId", (clinical as any).id ?? (clinical as any).patientClinicalId ?? "");
        setValue("patientHeight", clinical.patientHeight?.toString() ?? "");
        setValue("patientWeight", clinical.patientWeight?.toString() ?? "");
        setValue("patientHistory", clinical.patientHistory ?? "");
        setValue("familyHistory", clinical.familyHistory ?? "");
        setValue("chronicDisease", clinical.chronicDisease ?? "");
        setValue("acuteDisease", clinical.acuteDisease ?? "");
        setValue("toxicExposure", (clinical as any).toxicExposure ?? "");
        setValue("medicalHistory", clinical.medicalHistory ?? "");
        setValue("medicalUsing", Array.isArray(clinical.medicalUsing) ? clinical.medicalUsing.join(", ") : "");
      } else {
        setValue("patientClinicalId", "");
        setValue("patientHeight", "");
        setValue("patientWeight", "");
        setValue("patientHistory", "");
        setValue("familyHistory", "");
        setValue("chronicDisease", "");
        setValue("acuteDisease", "");
        setValue("toxicExposure", "");
        setValue("medicalUsing", "");
      }
    } catch {
      setValue("patientClinicalId", "");
      setValue("patientHeight", "");
      setValue("patientWeight", "");
      setValue("patientHistory", "");
      setValue("familyHistory", "");
      setValue("chronicDisease", "");
      setValue("acuteDisease", "");
      setValue("toxicExposure", "");
      setValue("medicalHistory", "");
      setValue("medicalUsing", "");
    }
  };

  if (loadingSpecify || !specify) {
    return (
      <View className="flex-1 bg-sky-50">
        <View className="pb-4 px-5 bg-white border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <View className="w-11 h-11 rounded-2xl bg-slate-200" />
            <View className="flex-1 items-center px-3">
              <View className="h-4 w-32 bg-slate-200 rounded mb-1" />
              <View className="h-3 w-24 bg-slate-100 rounded" />
            </View>
            <View className="w-16 h-9 rounded-2xl bg-slate-200" />
          </View>
        </View>
        <View className="flex-1 justify-center items-center py-20">
          <ActivityIndicator size="large" color="#0284C7" />
          <Text className="mt-3 text-slate-500 text-sm font-bold">
            {loadingSpecify ? "Đang tải..." : "Không tìm thấy phiếu xét nghiệm"}
          </Text>
          {!loadingSpecify && !specify && (
            <TouchableOpacity
              onPress={() => router.back()}
              className="mt-4 px-6 py-3 bg-sky-600 rounded-2xl"
            >
              <Text className="text-white font-bold">Quay lại</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <FormProvider {...methods}>
      <SafeAreaView className="flex-1 bg-sky-50" edges={["top", "left", "right"]}>
        <Stack.Screen options={stackScreenOptions} />
        <StatusBar barStyle="dark-content" />

        <View className="pb-4 px-5 bg-white border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleBack}
              className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-100 items-center justify-center"
              activeOpacity={0.75}
              disabled={isSubmitting}
            >
              <ArrowLeft size={22} color="#0284C7" strokeWidth={2.5} />
            </TouchableOpacity>

            <View className="flex-1 items-center px-3">
              <Text className="text-[15px] font-extrabold text-slate-900" numberOfLines={1}>
                Cập nhật phiếu xét nghiệm
              </Text>
              <Text className="mt-0.5 text-[11px] font-bold text-slate-500" numberOfLines={1}>
                {specify.specifyVoteID}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.back()}
              className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200"
              activeOpacity={0.75}
              disabled={isSubmitting}
            >
              <Text className="text-sm font-extrabold text-slate-700">Huỷ</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white px-5 pt-4 pb-5 border-b border-slate-200">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-[12px] font-bold text-slate-500">
                Bước {currentStep}/{TOTAL_STEPS}
              </Text>
              <Text className="mt-1 text-[14px] font-extrabold text-slate-900" numberOfLines={2}>
                {STEP_TITLES[currentStep - 1]}
              </Text>
            </View>
            <View className="px-3 py-1.5 rounded-2xl bg-sky-50 border border-sky-100">
              <Text className="text-sm font-extrabold text-sky-700">{currentStep}</Text>
            </View>
          </View>
          <Stepper
            totalSteps={TOTAL_STEPS}
            currentStep={currentStep}
            onStepPress={(s) => setCurrentStep(s)}
          />
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 110 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {[currentStep].map((stepNum) => (
            <View
              key={stepNum}
              style={{ display: stepNum === currentStep ? "flex" : "none" }}
            >
              {stepNum === 1 && (
                <Step1Patient currentPatient={specify?.patient} onPatientSelect={handlePatientSelect} />
              )}
              {stepNum === 2 && <Step2Clinical />}
              {stepNum === 3 && (
                <Step3ServiceTest
                  services={services}
                  genomeTests={genomeTests}
                  doctors={doctors}
                  hospitals={hospitals}
                  isCurrentUserDoctor={!!currentUserDoctor}
                />
              )}
              {stepNum === 4 && (
                <Step5ServiceType key={`step5-${methods.watch("serviceId") || "svc"}`} services={services} />
              )}
              {stepNum === 5 && <Step4GeneticResults />}
              {stepNum === 6 && <Step6Note />}
            </View>
          ))}
        </ScrollView>

        <View
          className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex-row gap-3"
          style={{ paddingBottom: Math.max(16, insets.bottom) }}
        >
          <TouchableOpacity
            className="flex-1 h-12 rounded-2xl items-center justify-center bg-white border border-slate-200"
            onPress={handleBack}
            activeOpacity={0.8}
            disabled={isSubmitting}
          >
            <Text className="text-[15px] font-extrabold text-slate-700">
              {currentStep === 1 ? "Huỷ" : "Quay lại"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 h-12 rounded-2xl items-center justify-center ${isSubmitting ? "bg-sky-400" : "bg-sky-600"
              }`}
            onPress={handleNext}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-extrabold text-white">
                {currentStep === TOTAL_STEPS ? "Cập nhật" : "Tiếp theo"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </FormProvider>
  );
}
