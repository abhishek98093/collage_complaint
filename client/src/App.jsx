import React from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { Route, Routes ,useLocation} from 'react-router-dom';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HomeRedirect from './components/HomeRedirect';
import CitizenComplaintPage from './pages/CitizenComplaintPage';
import InfoPage from './pages/InfoPage';
import AdminPersonnel from './pages/AdminPersonnel';
import AdminPerformanceAnalyser from './pages/AdminPerformanceAnalyser';
import InspectorDashboard from './pages/InspectorDashboard';
import SubInspectorDashboard from './pages/SubInspectorDashboard';
import InspectorComplaintPage from './pages/InspectorComplaintDashboard';
import PoliceListingPage from './pages/PoliceListingPage';
import TestPincode from './pages/TestPincode';
import CitizenListingPage from './pages/CitizenListingPage';
import CitizenLeadsPage from './pages/CitizenLeadsPage';
import PoliceLeadsPage from './pages/PoliceLeadsPage';
import InfoSection from './pages/InfoSection';
import About from './pages/About';
import TokenExpiryChecker from './components/TokenExpiryChecker';
import SubInspectorComplaintPage from './pages/SubInspectorComplaintPage';
import PoliceVerificationPage from './pages/PoliceVerificationPage';
const App = () => {
   const location = useLocation(); // 👈 current path

  const shouldApplyMargin = location.pathname !== '/landingpage';
  return (
    <div className="min-h-screen flex flex-col">
  <TokenExpiryChecker />
  <Navbar />
   <div className={`flex-grow ${shouldApplyMargin ? 'mt-16' : ''}`}> {/* Adjust mt-16 based on Navbar height */}
    <Routes>
      <Route path='/' element={<HomeRedirect />} />
      <Route path='/landingpage' element={<HomePage />} />
      <Route path='/login' element={<LoginPage />} />
      <Route path='/signup' element={<SignupPage />} />
      <Route path='/user/dashboard' element={<UserDashboard />} />
      <Route path='/admin/dashboard' element={<AdminDashboard />} />
      <Route path='/citizenComplaintPage' element={<CitizenComplaintPage />} />
      <Route path='/infopage' element={<InfoPage />} />
      <Route path='/personnelpage' element={<AdminPersonnel />} />
      <Route path='/adminpersonnelperformance' element={<AdminPerformanceAnalyser />} />
      <Route path='/inspectordashboard' element={<InspectorDashboard />} />
      <Route path='/subinspectordashboard' element={<SubInspectorDashboard />} />
      <Route path='/inspectorcomplaintpage' element={<InspectorComplaintPage />} />
      <Route path='/policelistingpage' element={<PoliceListingPage />} />
      <Route path='/testpincode' element={<TestPincode />} />
      <Route path='/citizenlistingpage' element={<CitizenListingPage />} />
      <Route path='/citizenleadspage' element={<CitizenLeadsPage />} />
      <Route path='/policeleadspage' element={<PoliceLeadsPage />} />
      <Route path='/infosection' element={<InfoSection />} />
      <Route path='/subinspectorcomplaintpage' element={<SubInspectorComplaintPage />} />
      <Route path='/policeverificationpage' element={<PoliceVerificationPage />} />
      <Route path='/about' element={<About />} />
    </Routes>
  </div>
  <Footer />
</div>

  );
};

export default App;






// import React from 'react';
// import Navbar from './components/Navbar';
// import Footer from './components/Footer';
// import { Route, Routes } from 'react-router-dom';

// // Pages
// import HomePage from './pages/HomePage';
// import LoginPage from './pages/LoginPage';
// import SignupPage from './pages/SignupPage';
// import CitizenDashboard from './pages/CitizenDashboard';
// import AdminDashboard from './pages/AdminDashboard';
// import PoliceDashboard from './pages/PoliceDashboard';
// import HomeRedirect from './components/HomeRedirect';
// import CitizenComplaintPage from './pages/CitizenComplaintPage';
// import InfoPage from './pages/InfoPage';
// import AdminPersonnel from './pages/AdminPersonnel';
// import AdminPerformenceAnalyse from './pages/AdminPerformenceAnalyse';
// import InspectorDashboard from './pages/InspectorDashboard';
// import SubInspectorDashboard from './pages/SubInspectorDashboard';
// import InspectorComplaintPage from './pages/InspectorComplaintDashboard';

// // ✅ Import TokenExpiryChecker
// import TokenExpiryChecker from './components/TokenExpiryChecker';

// const App = () => {
//   return (
//     <div>
//       {/* ✅ Periodic token validity checker */}
//       <TokenExpiryChecker />

//       <Navbar />

//       <div className='min-h-70vh'>
//         <Routes>
//           <Route path='/' element={<HomeRedirect />} />
//           <Route path='/landingpage' element={<HomePage />} />
//           <Route path='/login' element={<LoginPage />} />
//           <Route path='/signup' element={<SignupPage />} />
//           <Route path='/citizendashboard' element={<CitizenDashboard />} />
//           <Route path='/policedashboard' element={<PoliceDashboard />} />
//           <Route path='/admindashboard' element={<AdminDashboard />} />
//           <Route path='/citizenComplaintPage' element={<CitizenComplaintPage />} />
//           <Route path='/infopage' element={<InfoPage />} />
//           <Route path='/personnelpage' element={<AdminPersonnel />} />
//           <Route path='/personnelperformance' element={<AdminPerformenceAnalyse />} />
//           <Route path='/inspectordashboard' element={<InspectorDashboard />} />
//           <Route path='/subinspectordashboard' element={<SubInspectorDashboard />} />
//           <Route path='/inspectorcomplaintpage' element={<InspectorComplaintPage />} />
//         </Routes>
//       </div>

//       <Footer />
//     </div>
//   );
// };

// export default App;
