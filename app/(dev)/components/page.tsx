import { notFound } from 'next/navigation';
import { ComponentsDemo } from './ComponentsDemo';

export default function ComponentsPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <ComponentsDemo />;
}
