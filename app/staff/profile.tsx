import React from 'react';

import { AccountProfileScreen } from '@/components/account/AccountProfileScreen';

export default function ProfileScreen() {
  return <AccountProfileScreen changePasswordPath="/staff/change-password" />;
}
