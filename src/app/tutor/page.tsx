import { redirect } from 'next/navigation';
import { stackServerApp } from '@/stack';
import TutorClient from './TutorClient';

export default async function TutorPage() {
  const user = await stackServerApp.getUser();
  if (!user) redirect('/auth/signin');
  return <TutorClient />;
}
