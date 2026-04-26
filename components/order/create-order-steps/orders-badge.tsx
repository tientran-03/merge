import { getApiResponseData } from '@/lib/types/api-types';
import { orderService } from '@/services/orderService';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

export function OrdersInitiationBadge() {
  const { data: ordersResponse } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderService.getAll(),
  });

  const count = useMemo(() => {
    const orders = getApiResponseData<any>(ordersResponse) || [];
    return orders.filter((o: any) => String(o?.orderStatus).toLowerCase() === 'initiation').length;
  }, [ordersResponse]);

  if (count <= 0) return null;

  return (
    <View
      style={{
        marginLeft: 6,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: 'red',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{count}</Text>
    </View>
  );
}
