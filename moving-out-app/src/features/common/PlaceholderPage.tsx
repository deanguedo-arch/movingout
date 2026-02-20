type PlaceholderPageProps = {
  title: string;
  message: string;
};

export function PlaceholderPage({ title, message }: PlaceholderPageProps) {
  return (
    <section className="page">
      <header className="page-header">
        <h1>{title}</h1>
        <p>{message}</p>
      </header>
    </section>
  );
}
