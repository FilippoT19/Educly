import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ subject: string }>;
}

export default async function EserciziPage({ params }: PageProps) {
  const { subject } = await params;
  // Redirect to course page — topic selection is there
  redirect(`/course/${subject}`);
}
