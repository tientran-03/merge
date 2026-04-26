import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchProvinces,
  fetchDistricts,
  fetchWards,
  type VNProvinceAPI,
  type VNDistrictAPI,
  type VNWardAPI,
} from '@/services/addressService';

const STALE_TIME = 10 * 60 * 1000; 

export const addressQueryKeys = {
  provinces: ['address', 'provinces'] as const,
  districts: (provinceCode: number) => ['address', 'districts', provinceCode] as const,
  wards: (districtCode: number) => ['address', 'wards', districtCode] as const,
};

export function useProvinces() {
  return useQuery({
    queryKey: addressQueryKeys.provinces,
    queryFn: fetchProvinces,
    staleTime: STALE_TIME,
    gcTime: 30 * 60 * 1000, 
  });
}

export function useDistricts(provinceCode: number | null) {
  return useQuery({
    queryKey: addressQueryKeys.districts(provinceCode!),
    queryFn: () => fetchDistricts(provinceCode!),
    enabled: provinceCode != null && provinceCode > 0,
    staleTime: STALE_TIME,
    gcTime: 30 * 60 * 1000,
  });
}

export function useWards(districtCode: number | null) {
  return useQuery({
    queryKey: addressQueryKeys.wards(districtCode!),
    queryFn: () => fetchWards(districtCode!),
    enabled: districtCode != null && districtCode > 0,
    staleTime: STALE_TIME,
    gcTime: 30 * 60 * 1000,
  });
}

export function usePrefetchProvinces() {
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: addressQueryKeys.provinces,
      queryFn: fetchProvinces,
      staleTime: STALE_TIME,
    });
  }, [queryClient]);
}
