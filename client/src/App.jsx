import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import ProtectedLayout from './components/common/ProtectedLayout';
import RequireAuth from './components/common/RequireAuth';

import Landing from './pages/marketing/Landing';

import SignIn from './pages/auth/SignIn';
import SignUp from './pages/auth/SignUp';
import RoleSelect from './pages/auth/RoleSelect';

import Dashboard from './pages/dashboard/Dashboard';

import SetupList from './pages/setup/SetupList';
import SetupForm from './pages/setup/SetupForm';
import SetupDetail from './pages/setup/SetupDetail';
import SetupYearSeasons from './pages/setup/SetupYearSeasons';

import SeasonDetail from './pages/seasons/SeasonDetail';
import FarmerDataEntry from './pages/seasons/FarmerDataEntry';

import PlotDetail from './pages/plots/PlotDetail';

import CBADashboard from './pages/cba/CBADashboard';

import ScenarioInput from './pages/scenarios/ScenarioInput';

import TrendsOverview from './pages/trends/TrendsOverview';

import TrialSetupForm from './pages/trials/TrialSetupForm';
import TrialDetail from './pages/trials/TrialDetail';
import TrialPlotDetail from './pages/trialPlots/TrialPlotDetail';
import TrialAnalysisDashboard from './pages/trialAnalysis/TrialAnalysisDashboard';

import DataEntryHome from './pages/dataEntry/DataEntryHome';
import AnalysisHome from './pages/analysisHome/AnalysisHome';

import FarmsList from './pages/farms/FarmsList';
import FarmSeasons from './pages/farms/FarmSeasons';
import CbaResultsHome from './pages/farms/CbaResultsHome';
import SeasonalReportsHome from './pages/farms/SeasonalReportsHome';

import ReportBuilder from './pages/reports/ReportBuilder';
import FarmerSeasonalReport from './pages/reports/FarmerSeasonalReport';
import TrialReportBuilder from './pages/reports/TrialReportBuilder';

import SettingsPage from './pages/settings/SettingsPage';

import NotificationCenter from './pages/notifications/NotificationCenter';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/sign-in/*" element={<SignIn />} />
      <Route path="/sign-up/*" element={<SignUp />} />

      <Route element={<RequireAuth />}>
        <Route path="/select-role" element={<RoleSelect />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/setups" element={<SetupList />} />
        <Route path="/setups/new" element={<SetupForm />} />
        <Route path="/setups/:setupId" element={<SetupDetail />} />
        <Route path="/setups/:setupId/years/:year" element={<SetupYearSeasons />} />

        <Route path="/farms" element={<FarmsList />} />
        <Route path="/farms/:setupId/data-entry" element={<FarmSeasons mode="data-entry" />} />
        <Route path="/farms/:setupId/cba-results" element={<FarmSeasons mode="cba" />} />
        <Route path="/farms/:setupId/seasonal-reports" element={<FarmSeasons mode="reports" />} />
        <Route path="/cba-results" element={<CbaResultsHome />} />
        <Route path="/seasonal-reports" element={<SeasonalReportsHome />} />

        <Route path="/seasons/:seasonId" element={<SeasonDetail />} />
        <Route path="/seasons/:seasonId/data-entry" element={<FarmerDataEntry />} />
        <Route path="/seasons/:seasonId/cba" element={<CBADashboard />} />
        <Route path="/seasons/:seasonId/seasonal-report" element={<FarmerSeasonalReport />} />

        <Route path="/plots/:plotId" element={<PlotDetail />} />

        <Route path="/seasons/:seasonId/trials/new" element={<TrialSetupForm />} />
        <Route path="/trials/:trialId" element={<TrialDetail />} />
        <Route path="/trials/:trialId/analysis" element={<TrialAnalysisDashboard />} />
        <Route path="/trial-plots/:id" element={<TrialPlotDetail />} />

        <Route path="/data-entry" element={<DataEntryHome />} />
        <Route path="/analysis" element={<AnalysisHome />} />

        <Route path="/scenarios/:setupId" element={<ScenarioInput />} />
        <Route path="/trends/:setupId" element={<TrendsOverview />} />

        <Route path="/seasonal-reports/:setupId" element={<ReportBuilder />} />

        <Route path="/reports" element={<ReportBuilder />} />
        <Route path="/trial-reports" element={<TrialReportBuilder />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notifications" element={<NotificationCenter />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
