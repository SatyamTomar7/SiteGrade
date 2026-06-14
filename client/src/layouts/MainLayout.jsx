import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const MainLayout = ({ children }) => {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip transition-colors duration-300">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.2),transparent_52%)]" />
      <Navbar />
      <main id="main-content" className="flex-grow" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
};
