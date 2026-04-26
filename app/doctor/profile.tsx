import React from 'react';

import { AccountProfileScreen } from '@/components/account/AccountProfileScreen';

export default function DoctorProfileScreen() {
  return <AccountProfileScreen changePasswordPath="/doctor/change-password" />;
}
