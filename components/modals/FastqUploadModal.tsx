import * as DocumentPicker from 'expo-document-picker';
import {
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSheetBottomInset } from '@/lib/useSheetBottomInset';
import {
  isAcceptedFastqFileName,
  quickValidateFastqPair,
  type FastqValidationResponse,
} from '@/lib/fastq/quickValidate';
import { MEDICAL } from '@/lib/theme/medical';
import {
  uploadFastqFiles,
  type PickedFile,
  type UploadMetadata,
  type UploadProgress,
} from '@/services/fastqUploadService';

interface FastqUploadModalProps {
  visible: boolean;
  onClose: () => void;
  metadata: UploadMetadata;
  onSuccess?: () => void | Promise<void>;
}

const formatFileSize = (bytes: number): string => {
  if (!bytes) return '';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
};

function ReadTypeBadge({
  readType,
  prefer,
}: {
  readType?: 'R1' | 'R2' | 'UNKNOWN';
  prefer: 'R1' | 'R2';
}) {
  if (!readType || readType === 'UNKNOWN') return null;
  const ok = readType === prefer;
  return (
    <View
      className={`ml-2 px-2 py-0.5 rounded-md ${ok ? 'bg-emerald-100' : 'bg-amber-100'}`}
    >
      <Text className={`text-[10px] font-extrabold ${ok ? 'text-emerald-800' : 'text-amber-900'}`}>
        {readType}
      </Text>
    </View>
  );
}

function FastqUploadModalComponent({ visible, onClose, metadata, onSuccess }: FastqUploadModalProps) {
  const sheetBottomInset = useSheetBottomInset();
  const [fastq1, setFastq1] = useState<PickedFile | null>(null);
  const [fastq2, setFastq2] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ fastq1: 0, fastq2: 0 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationResult, setValidationResult] = useState<FastqValidationResponse | null>(null);

  useEffect(() => {
    setValidationResult(null);
  }, [fastq1, fastq2]);

  const pickFile = async (target: '1' | '2') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const name = asset.name || 'file';
      if (!isAcceptedFastqFileName(name)) {
        setError(
          `File "${name}" không đúng định dạng. Chỉ chấp nhận: .fastq, .fastq.gz, .fq, .fq.gz`,
        );
        return;
      }
      const file: PickedFile = {
        uri: asset.uri,
        name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType,
      };
      if (target === '1') setFastq1(file);
      else setFastq2(file);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể chọn file';
      setError(msg);
    }
  };

  const handleQuickValidate = () => {
    if (!fastq1 || !fastq2) return;
    setError(null);
    setValidationResult(quickValidateFastqPair(fastq1, fastq2));
  };

  const handleUpload = async () => {
    if (!fastq1 || !fastq2) {
      setError('Vui lòng chọn đủ 2 file FASTQ (R1 và R2)');
      return;
    }
    setUploading(true);
    setError(null);
    setProgress({ fastq1: 0, fastq2: 0 });
    try {
      await uploadFastqFiles(metadata, fastq1, fastq2, setProgress);
      await onSuccess?.();
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload thất bại';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFastq1(null);
      setFastq2(null);
      setProgress({ fastq1: 0, fastq2: 0 });
      setError(null);
      setSuccess(false);
      setValidationResult(null);
      onClose();
    }
  };

  const canValidate = !!fastq1 && !!fastq2 && !uploading;
  const canUpload = !!fastq1 && !!fastq2 && !uploading;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable className="flex-1" onPress={handleClose} />
        <View className="max-h-[92%] rounded-t-3xl bg-white" style={{ paddingBottom: sheetBottomInset }}>
          <View className="h-1.5 w-12 self-center rounded-full bg-slate-200 mt-2" />
          <View className="px-4 pt-2 pb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-slate-900">Upload FASTQ</Text>
              <TouchableOpacity
                onPress={handleClose}
                disabled={uploading}
                className="p-2 rounded-full bg-slate-100"
              >
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text className="text-sm text-slate-600 mb-2">
              Upload 2 file FASTQ cho labcode:{' '}
              <Text className="font-extrabold text-slate-900">{metadata.labcode}</Text>
            </Text>

            {success ? (
              <View className="py-8 items-center">
                <View className="w-16 h-16 rounded-full bg-emerald-100 items-center justify-center">
                  <CheckCircle size={32} color="#10b981" />
                </View>
                <Text className="mt-4 text-lg font-bold text-slate-900">Upload thành công!</Text>
                <TouchableOpacity
                  onPress={handleClose}
                  className="mt-6 px-8 py-3 bg-sky-600 rounded-xl"
                >
                  <Text className="text-white font-semibold">Đóng</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} className="max-h-[72vh]">
                <View className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
                  <Text className="text-[11px] font-bold text-slate-500 uppercase mb-2">
                    Thông tin mẫu
                  </Text>
                  <View className="gap-1.5">
                    <MetaRow label="Mã bệnh nhân" value={metadata.patientId} />
                    <MetaRow label="Tên bệnh nhân" value={metadata.patientName} />
                    <MetaRow label="Số điện thoại" value={metadata.phoneNumber} />
                    <MetaRow label="Bệnh viện" value={metadata.hospitalName} />
                    <MetaRow label="Tên mẫu" value={metadata.sampleName} />
                    <MetaRow label="Lab code" value={metadata.labcode} />
                  </View>
                </View>

                <Text className="text-sm font-bold text-slate-800 mb-2">
                  FASTQ 1 (R1 - Forward) <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => !uploading && pickFile('1')}
                  disabled={uploading}
                  className={`mb-3 rounded-xl border-2 border-dashed p-4 ${fastq1 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'
                    }`}
                >
                  {fastq1 ? (
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 flex-row items-center flex-wrap">
                        <View className="flex-1 min-w-0">
                          <Text className="font-semibold text-slate-800" numberOfLines={2}>
                            {fastq1.name}
                          </Text>
                          <View className="flex-row items-center flex-wrap mt-0.5">
                            <Text className="text-xs text-slate-500">{formatFileSize(fastq1.size)}</Text>
                            <ReadTypeBadge
                              readType={validationResult?.fastq1Result?.readType}
                              prefer="R1"
                            />
                          </View>
                        </View>
                      </View>
                      {!uploading && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setFastq1(null);
                          }}
                          className="p-1"
                        >
                          <X size={18} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View className="items-center py-2">
                      <Upload size={28} color="#94a3b8" />
                      <Text className="mt-2 text-sm text-slate-600 text-center">
                        Chạm để chọn FASTQ 1 (R1)
                      </Text>
                      <Text className="text-xs text-slate-400 text-center">
                        Hỗ trợ: .fastq, .fastq.gz, .fq, .fq.gz
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {uploading ? (
                  <View className="mb-3">
                    <View className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${progress.fastq1}%` }}
                      />
                    </View>
                    <Text className="text-xs text-slate-500 mt-1">FASTQ 1: {progress.fastq1}%</Text>
                  </View>
                ) : null}

                <Text className="text-sm font-bold text-slate-800 mb-2">
                  FASTQ 2 (R2 - Reverse) <Text className="text-red-500">*</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => !uploading && pickFile('2')}
                  disabled={uploading}
                  className={`mb-3 rounded-xl border-2 border-dashed p-4 ${fastq2 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'
                    }`}
                >
                  {fastq2 ? (
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 min-w-0">
                        <Text className="font-semibold text-slate-800" numberOfLines={2}>
                          {fastq2.name}
                        </Text>
                        <View className="flex-row items-center flex-wrap mt-0.5">
                          <Text className="text-xs text-slate-500">{formatFileSize(fastq2.size)}</Text>
                          <ReadTypeBadge
                            readType={validationResult?.fastq2Result?.readType}
                            prefer="R2"
                          />
                        </View>
                      </View>
                      {!uploading && (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setFastq2(null);
                          }}
                          className="p-1"
                        >
                          <X size={18} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View className="items-center py-2">
                      <Upload size={28} color="#94a3b8" />
                      <Text className="mt-2 text-sm text-slate-600 text-center">
                        Chạm để chọn FASTQ 2 (R2)
                      </Text>
                      <Text className="text-xs text-slate-400 text-center">
                        Hỗ trợ: .fastq, .fastq.gz, .fq, .fq.gz
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {uploading ? (
                  <View className="mb-4">
                    <View className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <View
                        className="h-full bg-sky-600 rounded-full"
                        style={{ width: `${progress.fastq2}%` }}
                      />
                    </View>
                    <Text className="text-xs text-slate-500 mt-1">FASTQ 2: {progress.fastq2}%</Text>
                  </View>
                ) : null}

                {validationResult ? (
                  <View
                    className={`mb-3 rounded-xl p-3 border ${validationResult.valid
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                      }`}
                  >
                    <View className="flex-row items-start gap-2">
                      {validationResult.valid ? (
                        <CheckCircle size={20} color="#059669" />
                      ) : (
                        <AlertTriangle size={20} color="#dc2626" />
                      )}
                      <Text
                        className={`flex-1 text-sm font-bold ${validationResult.valid ? 'text-emerald-900' : 'text-red-900'
                          }`}
                      >
                        {validationResult.message}
                      </Text>
                    </View>
                    {validationResult.pairValidationMessage ? (
                      <Text
                        className={`text-xs mt-2 leading-5 ${validationResult.isPairedCorrectly ? 'text-emerald-800' : 'text-red-800'
                          }`}
                      >
                        {validationResult.pairValidationMessage}
                      </Text>
                    ) : null}
                    {validationResult.errors?.length ? (
                      <View className="mt-2">
                        <Text className="text-xs font-bold text-red-800">Lỗi:</Text>
                        {validationResult.errors.map((err, idx) => (
                          <Text key={idx} className="text-xs text-red-700 mt-0.5">
                            • {err}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {validationResult.warnings?.length ? (
                      <View className="mt-2">
                        <Text className="text-xs font-bold text-amber-900">Cảnh báo:</Text>
                        {validationResult.warnings.map((w, idx) => (
                          <Text key={idx} className="text-xs text-amber-900 mt-0.5">
                            • {w}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3">
                  <Text className="text-xs text-sky-950 leading-5">
                    <Text className="font-bold">Lưu ý:</Text> Nên bấm «Kiểm tra nhanh» trước khi
                    upload để đảm bảo cặp R1/R2 và định dạng file hợp lệ

                  </Text>
                </View>

                {error ? (
                  <View className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200">
                    <Text className="text-sm text-red-700">{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleQuickValidate}
                  disabled={!canValidate}
                  className={`mb-3 py-3 rounded-xl border-2 flex-row items-center justify-center gap-2 ${canValidate ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-slate-100 opacity-60'
                    }`}
                >
                  <ShieldCheck size={18} color={canValidate ? MEDICAL.primary : '#94a3b8'} />
                  <Text
                    className={`font-extrabold ${canValidate ? 'text-sky-800' : 'text-slate-400'}`}
                  >
                    Kiểm tra nhanh
                  </Text>
                </TouchableOpacity>

                <View className="flex-row gap-3 mt-1">
                  <TouchableOpacity
                    onPress={handleClose}
                    disabled={uploading}
                    className="flex-1 py-3 rounded-xl bg-slate-100"
                  >
                    <Text className="text-center font-bold text-slate-700">Đóng</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleUpload}
                    disabled={!canUpload}
                    className={`flex-1 py-3 rounded-xl flex-row items-center justify-center ${canUpload ? 'bg-sky-600' : 'bg-slate-300'
                      }`}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Upload size={18} color="#fff" />
                        <Text className="ml-2 font-bold text-white">Bắt đầu upload</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MetaRow({ label, value }: { label: string; value?: string }) {
  return (
    <View className="flex-row flex-wrap">
      <Text className="text-xs text-slate-500 w-[100px]">{label}</Text>
      <Text className="text-xs font-semibold text-slate-900 flex-1">{value || '—'}</Text>
    </View>
  );
}

FastqUploadModalComponent.displayName = 'FastqUploadModal';

export const FastqUploadModal = FastqUploadModalComponent;
