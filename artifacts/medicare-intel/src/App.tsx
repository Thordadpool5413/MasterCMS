import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Nav } from "@/components/layout/nav";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import NationalDashboardPage from "@/pages/national-dashboard";
import ChatPage from "@/pages/chat";
import HospiceMarketPage from "@/pages/hospice-market";
import HospitalOpportunityPage from "@/pages/hospital-opportunity";
import NursingHomePage from "@/pages/nursing-home";
import NpiLookupPage from "@/pages/npi-lookup";
import DrugSpendingPage from "@/pages/drug-spending";
import PrescribersPage from "@/pages/prescribers";
import CompetitorIntelPage from "@/pages/competitor-intel";
import ClinicalTrialsPage from "@/pages/clinical-trials";
import SettingsPage from "@/pages/settings";
import CacheManagementPage from "@/pages/cache-management";

const queryClient = new QueryClient();

function Router() {
  return (
    <>
      <Nav />
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/national-dashboard" component={NationalDashboardPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/hospice-market" component={HospiceMarketPage} />
        <Route path="/hospital-opportunity" component={HospitalOpportunityPage} />
        <Route path="/nursing-home" component={NursingHomePage} />
        <Route path="/npi-lookup" component={NpiLookupPage} />
        <Route path="/drug-spending" component={DrugSpendingPage} />
        <Route path="/prescribers" component={PrescribersPage} />
        <Route path="/competitor-intel" component={CompetitorIntelPage} />
        <Route path="/clinical-trials" component={ClinicalTrialsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/cache-management" component={CacheManagementPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
