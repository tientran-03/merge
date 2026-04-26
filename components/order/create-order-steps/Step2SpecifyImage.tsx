import * as ImagePicker from 'expo-image-picker';
import { Camera, X, Image as ImageIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';

interface Step2Props {
  isUploading?: boolean;
  onImageSelect?: (uri: string) => Promise<string | null>;
}

export default function Step2SpecifyImage({ isUploading = false, onImageSelect }: Step2Props) {
  const { watch, setValue } = useFormContext();
  const specifyVoteTestImagePath = watch('specifyVoteTestImagePath');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const displayImage = localImageUri || specifyVoteTestImagePath;

  const handleSelectImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Ứng dụng cần quyền truy cập thư viện ảnh để chọn hình ảnh.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLocalImageUri(uri);

        if (onImageSelect) {
          const uploadedUrl = await onImageSelect(uri);
          if (uploadedUrl) {
            setValue('specifyVoteTestImagePath', uploadedUrl);
          }
        } else {
          setValue('specifyVoteTestImagePath', uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Lỗi', 'Không thể chọn hình ảnh. Vui lòng thử lại.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Quyền truy cập', 'Ứng dụng cần quyền truy cập camera để chụp ảnh.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        setLocalImageUri(uri);

        if (onImageSelect) {
          const uploadedUrl = await onImageSelect(uri);
          if (uploadedUrl) {
            setValue('specifyVoteTestImagePath', uploadedUrl);
          }
        } else {
          setValue('specifyVoteTestImagePath', uri);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Lỗi', 'Không thể chụp ảnh. Vui lòng thử lại.');
    }
  };

  const handleRemoveImage = () => {
    setLocalImageUri(null);
    setValue('specifyVoteTestImagePath', '');
  };

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4">
      <Text className="text-[15px] font-extrabold text-slate-900 mb-4">
        Hình ảnh phiếu xét nghiệm
      </Text>

      {isUploading ? (
        <View className="h-48 bg-slate-50 rounded-xl items-center justify-center border border-dashed border-slate-300">
          <ActivityIndicator size="large" color="#0891B2" />
          <Text className="mt-2 text-[13px] text-slate-500">Đang tải ảnh lên...</Text>
        </View>
      ) : displayImage ? (
        <View className="relative">
          <Image
            source={{ uri: displayImage }}
            className="w-full h-64 rounded-xl"
            resizeMode="contain"
          />
          <TouchableOpacity
            onPress={handleRemoveImage}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 items-center justify-center"
            activeOpacity={0.8}
          >
            <X size={18} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSelectImage}
            className="mt-3 flex-row items-center justify-center py-3 bg-slate-100 rounded-xl"
            activeOpacity={0.8}
          >
            <ImageIcon size={18} color="#475569" />
            <Text className="ml-2 text-[14px] font-bold text-slate-600">Chọn ảnh khác</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <View className="h-48 bg-slate-50 rounded-xl items-center justify-center border border-dashed border-slate-300">
            <ImageIcon size={48} color="#94A3B8" />
            <Text className="mt-2 text-[13px] text-slate-500">Chưa có hình ảnh</Text>
          </View>

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={handleTakePhoto}
              className="flex-1 flex-row items-center justify-center py-3 bg-cyan-50 border border-cyan-200 rounded-xl"
              activeOpacity={0.8}
            >
              <Camera size={18} color="#0891B2" />
              <Text className="ml-2 text-[14px] font-bold text-cyan-700">Chụp ảnh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSelectImage}
              className="flex-1 flex-row items-center justify-center py-3 bg-slate-100 rounded-xl"
              activeOpacity={0.8}
            >
              <ImageIcon size={18} color="#475569" />
              <Text className="ml-2 text-[14px] font-bold text-slate-600">Chọn từ thư viện</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text className="mt-3 text-[11px] text-slate-500 text-center">
        Hỗ trợ định dạng JPG, PNG, PDF. Kích thước tối đa 10MB.
      </Text>
    </View>
  );
}
