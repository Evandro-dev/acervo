import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DeveloperCredits } from "@/components/common/DeveloperCredits";
import { RouteFallback } from "@/components/ui/route-fallback";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/features/auth/auth-context";
import Home from "./pages/Home";

const Eventos = lazy(() => import("./pages/Eventos"));
const EventoDetalhe = lazy(() => import("./pages/EventoDetalhe"));
const ArtigoDetalhe = lazy(() => import("./pages/ArtigoDetalhe"));
const Publicacoes = lazy(() => import("./pages/Publicacoes"));
const Autores = lazy(() => import("./pages/Autores"));
const AutorDetalhe = lazy(() => import("./pages/AutorDetalhe"));
const Areas = lazy(() => import("./pages/Areas"));
const Sobre = lazy(() => import("./pages/Sobre"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminPublicacoes = lazy(() => import("./pages/admin/AdminPublicacoes"));
const AdminImportar = lazy(() => import("./pages/admin/AdminImportar"));
const AdminEventos = lazy(() => import("./pages/admin/AdminEventos"));
const AdminEventoForm = lazy(() => import("./pages/admin/AdminEventoForm"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const AdminRelatorios = lazy(() => import("./pages/admin/AdminRelatorios"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />

        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/eventos" element={<Eventos />} />
              <Route path="/eventos/:id" element={<EventoDetalhe />} />
              <Route path="/eventos/:eventId/artigos/:articleId" element={<ArtigoDetalhe />} />
              <Route path="/publicacoes" element={<Publicacoes />} />
              <Route path="/autores" element={<Autores />} />
              <Route path="/autores/:name" element={<AutorDetalhe />} />
              <Route path="/areas" element={<Areas />} />
              <Route path="/sobre" element={<Sobre />} />

              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/publicacoes" element={<AdminPublicacoes />} />
              <Route path="/admin/importar" element={<AdminImportar />} />
              <Route path="/admin/eventos" element={<AdminEventos />} />
              <Route path="/admin/eventos/novo" element={<AdminEventoForm />} />
              <Route path="/admin/eventos/:id" element={<AdminEventoForm />} />
              <Route path="/admin/usuarios" element={<AdminUsuarios />} />
              <Route path="/admin/relatorios" element={<AdminRelatorios />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>

        <DeveloperCredits />
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
