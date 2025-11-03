import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/stack";

type PageProps = {
  params: Promise<{ stack?: string[] }>;
  searchParams?: Promise<Record<string, string>>;
};

export default async function Handler(props: PageProps) {
  return <StackHandler app={stackServerApp} fullPage routeProps={props} />;
}

