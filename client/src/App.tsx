import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import StudentExam from "./pages/StudentExam";

function AdminRoute() {
  return <AdminDashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/student" component={StudentExam} />
      <Route path="/admin" component={AdminRoute} />
      <Route path="/admin/assessments" component={AdminRoute} />
      <Route path="/admin/questions" component={AdminRoute} />
      <Route path="/admin/schools" component={AdminRoute} />
      <Route path="/admin/teachers" component={AdminRoute} />
      <Route path="/admin/students" component={AdminRoute} />
      <Route path="/admin/results" component={AdminRoute} />
      <Route path="/admin/reports" component={AdminRoute} />
      <Route path="/admin/settings" component={AdminRoute} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
