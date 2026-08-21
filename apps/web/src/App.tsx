import { Routes, Route } from 'react-router';
import type { SiteConfig } from '@template/shared';
import { Layout } from './components/Layout';
import { Card } from './components/Card';
import { moduleRoutes } from './modules.config';

const siteConfig: SiteConfig = { name: 'Exemplar' };

function Home() {
  return (
    <Card>
      <h1 className="text-2xl font-bold">{siteConfig.name}</h1>
      <p className="mt-2 text-muted">A placeholder brand for the project template.</p>
    </Card>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        {moduleRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Route>
    </Routes>
  );
}
