import React from 'react';
import { useFormContext } from 'react-hook-form';
import { View, Text } from 'react-native';

import { FormReadOnly, FormFieldGroup } from '@/components/form';

export default function Step5GeneticResults() {
  const { watch } = useFormContext();

  const geneticTestResults = watch('geneticTestResults');
  const geneticTestResultsRelationship = watch('geneticTestResultsRelationship');

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Kết quả xét nghiệm di truyền
      </Text>

      <FormFieldGroup>
        <FormReadOnly label="Bản thân" value={geneticTestResults} placeholder="Chưa có kết quả" />
        <FormReadOnly
          label="Người thân"
          value={geneticTestResultsRelationship}
          placeholder="Chưa có kết quả"
        />
      </FormFieldGroup>

      <View className="mt-2 p-3 bg-sky-50 rounded-xl border border-sky-200">
        <Text className="text-[11px] text-sky-700 font-medium">
          Lưu ý: Kết quả xét nghiệm di truyền được nhập từ phiếu xét nghiệm và chỉ có thể xem tại
          đây.
        </Text>
      </View>
    </View>
  );
}
