import React from "react";
import { View, Text } from "react-native";

import { FormTextarea } from "@/components/form";

export default function Step4GeneticResults() {
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Kết quả xét nghiệm di truyền trước đó
      </Text>

      <FormTextarea
        name="geneticTestResults"
        label="Kết quả xét nghiệm di truyền của bản thân"
        placeholder="Nhập kết quả xét nghiệm di truyền trước đó của bệnh nhân"
        minHeight={88}
      />

      <FormTextarea
        name="geneticTestResultsRelationship"
        label="Kết quả xét nghiệm di truyền của người thân"
        placeholder="Nhập kết quả xét nghiệm di truyền trước đó của người thân"
        minHeight={88}
      />
    </View>
  );
}
