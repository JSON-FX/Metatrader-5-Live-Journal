import Header from '../components/shared/Header';

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Header title="Live Trading" backHref="/" />
      {children}
    </div>
  );
}
