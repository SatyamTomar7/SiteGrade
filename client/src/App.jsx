import { AppRoutes } from './routes/AppRoutes';
import { MainLayout } from './layouts/MainLayout';

function App() {
  return (
    <MainLayout>
      <AppRoutes />
    </MainLayout>
  );
}

export default App;