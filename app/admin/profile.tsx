import React from 'react';

import { AccountProfileScreen } from '@/components/account/AccountProfileScreen';

export default function AdminProfileScreen() {
  return <AccountProfileScreen changePasswordPath="/admin/change-password" />;
}
