import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import HelpCenter from "@/pages/HelpCenter";
import ContractsList from "@/pages/ContractsList";
import ContractForm from "@/pages/ContractForm";
import SavingsTracker from "@/pages/SavingsTracker";
import VendorOnboarding from "@/pages/VendorOnboarding";
import VendorRiskScoring from "@/pages/VendorRiskScoring";
import RenewalCalendar from "@/pages/RenewalCalendar";
import WorkflowBuilder from "@/pages/WorkflowBuilder";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import PurchaseRequestsList from "./pages/PurchaseRequestsList";
// PurchaseRequestForm replaced by PurchaseRequestPage
import PurchaseRequestPage from "./pages/PurchaseRequestPage";
import VendorsList from "./pages/VendorsList";
import VendorForm from "./pages/VendorForm";
import VendorDetail from "./pages/VendorDetail";
import ApprovalsList from "./pages/ApprovalsList";
import InvoicesList from "./pages/InvoicesList";
import InvoiceForm from "./pages/InvoiceForm";
import SignaturePage from "./pages/SignaturePage";
import ExpensesList from "./pages/ExpensesList";
import ExpenseForm from "./pages/ExpenseForm";
import ExpenseDetail from "./pages/ExpenseDetail";
import Community from "./pages/Community";
import GroupsPage from "./pages/GroupsPage";
import SupplierPortal from "./pages/SupplierPortal";
import Analytics from "./pages/Analytics";
import PurchaseOrdersList from "./pages/PurchaseOrdersList";
import PurchaseOrderForm from "./pages/PurchaseOrderForm";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import Settings from "./pages/Settings";
import BudgetsList from "./pages/BudgetsList";
import BudgetForm from "./pages/BudgetForm";
import BudgetDetail from "./pages/BudgetDetail";
import InvoiceDetail from "./pages/InvoiceDetail";
import RFQsList from "./pages/RFQsList";
import RFQForm from "./pages/RFQForm";
import RFQDetail from "./pages/RFQDetail";
import InventoryPage from "./pages/InventoryPage";
import PaymentsList from "./pages/PaymentsList";
import PaymentDetail from "./pages/PaymentDetail";
import ReportBuilder from "./pages/ReportBuilder";

function Router() {
  return (
    <Switch>
      <Route path="/login"><Home /></Route>
      <Route path="/"><DashboardLayout><Dashboard /></DashboardLayout></Route>
      <Route path="/purchase-requests"><DashboardLayout><PurchaseRequestsList /></DashboardLayout></Route>
      <Route path="/purchase-requests/new"><DashboardLayout><PurchaseRequestPage /></DashboardLayout></Route>
      
      <Route path="/purchase-requests/:id"><DashboardLayout><PurchaseRequestPage /></DashboardLayout></Route>
      <Route path="/approvals"><DashboardLayout><ApprovalsList /></DashboardLayout></Route>
      <Route path="/approvals/:id"><DashboardLayout><ApprovalsList /></DashboardLayout></Route>
      <Route path="/purchase-orders"><DashboardLayout><PurchaseOrdersList /></DashboardLayout></Route>
      <Route path="/purchase-orders/new"><DashboardLayout><PurchaseOrderForm /></DashboardLayout></Route>
      <Route path="/purchase-orders/:id"><DashboardLayout><PurchaseOrderDetail /></DashboardLayout></Route>
      <Route path="/vendors"><DashboardLayout><VendorsList /></DashboardLayout></Route>
      <Route path="/vendors/new"><DashboardLayout><VendorForm /></DashboardLayout></Route>
      <Route path="/vendors/:id"><DashboardLayout><VendorDetail /></DashboardLayout></Route>
      <Route path="/invoices"><DashboardLayout><InvoicesList /></DashboardLayout></Route>
      <Route path="/invoices/new"><DashboardLayout><InvoiceForm /></DashboardLayout></Route>
      <Route path="/sign"><SignaturePage /></Route>
      <Route path="/expenses"><DashboardLayout><ExpensesList /></DashboardLayout></Route>
      <Route path="/expenses/new"><DashboardLayout><ExpenseForm /></DashboardLayout></Route>
      <Route path="/expenses/:id"><DashboardLayout><ExpenseDetail /></DashboardLayout></Route>
      <Route path="/community"><DashboardLayout><Community /></DashboardLayout></Route>
      <Route path="/groups"><DashboardLayout><GroupsPage /></DashboardLayout></Route>
      <Route path="/supplier-portal"><SupplierPortal /></Route>
      <Route path="/invoices/:id"><DashboardLayout><InvoiceDetail /></DashboardLayout></Route>
      <Route path="/payments"><DashboardLayout><PaymentsList /></DashboardLayout></Route>
      <Route path="/payments/:id"><DashboardLayout><PaymentDetail /></DashboardLayout></Route>
      <Route path="/budgets"><DashboardLayout><BudgetsList /></DashboardLayout></Route>
      <Route path="/budgets/new"><DashboardLayout><BudgetForm /></DashboardLayout></Route>
      <Route path="/budgets/:id"><DashboardLayout><BudgetDetail /></DashboardLayout></Route>
      <Route path="/rfqs"><DashboardLayout><RFQsList /></DashboardLayout></Route>
      <Route path="/rfqs/new"><DashboardLayout><RFQForm /></DashboardLayout></Route>
      <Route path="/rfqs/:id"><DashboardLayout><RFQDetail /></DashboardLayout></Route>
      <Route path="/inventory"><DashboardLayout><InventoryPage /></DashboardLayout></Route>
      <Route path="/analytics"><DashboardLayout><Analytics /></DashboardLayout></Route>
      <Route path="/reports"><DashboardLayout><ReportBuilder /></DashboardLayout></Route>
      <Route path="/settings"><DashboardLayout><Settings /></DashboardLayout></Route>
      <Route path="/help"><DashboardLayout><HelpCenter /></DashboardLayout></Route>
      <Route path="/contracts"><DashboardLayout><ContractsList /></DashboardLayout></Route>
      <Route path="/contracts/new"><DashboardLayout><ContractForm /></DashboardLayout></Route>
      <Route path="/savings"><DashboardLayout><SavingsTracker /></DashboardLayout></Route>
      <Route path="/vendor-onboarding"><DashboardLayout><VendorOnboarding /></DashboardLayout></Route>
      <Route path="/vendor-risk"><DashboardLayout><VendorRiskScoring /></DashboardLayout></Route>
      <Route path="/renewal-calendar"><DashboardLayout><RenewalCalendar /></DashboardLayout></Route>
      <Route path="/workflow-builder"><DashboardLayout><WorkflowBuilder /></DashboardLayout></Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable={true}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
