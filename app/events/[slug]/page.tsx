import DemoEventPage from "../demo-event/page";

export default async function EventPage({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  return <DemoEventPage slug={slug} />;
}
