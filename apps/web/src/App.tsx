import { Routes, Route } from 'react-router';
import type { SiteConfig } from '@template/shared';

const siteConfig: SiteConfig = { name: 'Exemplar' };

function Home() {
  return <h1>{siteConfig.name}</h1>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
