import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Submission {
  id: string;
  registration_type?: string | null;
  author_type?: string | null;
  payment_status?: string | null;
  fee_amount?: string | null;
}

interface PaymentDashboardProps {
  payments: Submission[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const parseAmount = (feeStr: string | null | undefined): { val: number; currency: string } => {
  if (!feeStr) return { val: 0, currency: '₹' };
  const str = feeStr.trim();
  const currency = str.includes('$') ? '$' : '₹';
  const val = parseFloat(str.replace(/[^0-9.]/g, ''));
  return { val: isNaN(val) ? 0 : val, currency };
};

const formatCurrency = (amount: number, currency: string) => {
  return `${currency}${amount.toLocaleString()}`;
};

export const PaymentDashboard: React.FC<PaymentDashboardProps> = ({ payments }) => {
  const metrics = useMemo(() => {
    let scopusCount = 0;
    let conferenceAloneCount = 0;
    let indianAuthorCount = 0;
    let industryCount = 0;

    let totalINR = 0;
    let totalUSD = 0;

    let indianScopusINR = 0;
    let indianAloneINR = 0;
    let industryScopusINR = 0;
    let industryAloneINR = 0;

    payments.forEach(sub => {
      const regType = (sub.registration_type || '').trim();
      const authType = (sub.author_type || '').trim();
      const { val, currency } = parseAmount(sub.fee_amount);

      // Counts
      if (regType === 'Conference with Scopus proceedings') scopusCount++;
      if (regType === 'Conference alone') conferenceAloneCount++;
      if (authType === 'Indian Author') indianAuthorCount++;
      if (authType === 'Industry Delegate/Research Scholar' || authType === 'Industry') industryCount++;

      // Amounts
      if (currency === '₹') totalINR += val;
      if (currency === '$') totalUSD += val;

      if (authType === 'Indian Author' && regType === 'Conference with Scopus proceedings') {
        indianScopusINR += val;
      }
      if (authType === 'Indian Author' && regType === 'Conference alone') {
        indianAloneINR += val;
      }
      if ((authType === 'Industry Delegate/Research Scholar' || authType === 'Industry') && regType === 'Conference with Scopus proceedings') {
        industryScopusINR += val;
      }
      if ((authType === 'Industry Delegate/Research Scholar' || authType === 'Industry') && regType === 'Conference alone') {
        industryAloneINR += val;
      }
    });

    return {
      scopusCount,
      conferenceAloneCount,
      indianAuthorCount,
      industryCount,
      totalINR,
      totalUSD,
      indianScopusINR,
      indianAloneINR,
      industryScopusINR,
      industryAloneINR,
    };
  }, [payments]);

  const regTypeData = [
    { name: 'Scopus Proceedings', value: metrics.scopusCount },
    { name: 'Conference Alone', value: metrics.conferenceAloneCount },
  ];

  const authorTypeData = [
    { name: 'Indian Author', value: metrics.indianAuthorCount },
    { name: 'Industry', value: metrics.industryCount },
    { name: 'Others', value: payments.length - metrics.indianAuthorCount - metrics.industryCount }
  ];

  const revenueData = [
    {
      name: 'Indian Author',
      'Scopus Proceedings': metrics.indianScopusINR,
      'Conference Alone': metrics.indianAloneINR,
    },
    {
      name: 'Industry Delegate',
      'Scopus Proceedings': metrics.industryScopusINR,
      'Conference Alone': metrics.industryAloneINR,
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
          <div className="text-sm font-semibold text-brand-text/60 mb-1">Total Amount (₹)</div>
          <div className="text-2xl font-bold font-serif text-green-700">{formatCurrency(metrics.totalINR, '₹')}</div>
        </div>
        <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
          <div className="text-sm font-semibold text-brand-text/60 mb-1">Total Amount ($)</div>
          <div className="text-2xl font-bold font-serif text-blue-700">{formatCurrency(metrics.totalUSD, '$')}</div>
        </div>
        <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
          <div className="text-sm font-semibold text-brand-text/60 mb-1">Scopus Registrations</div>
          <div className="text-2xl font-bold font-serif text-purple-700">{metrics.scopusCount}</div>
        </div>
        <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
          <div className="text-sm font-semibold text-brand-text/60 mb-1">Conference Alone</div>
          <div className="text-2xl font-bold font-serif text-amber-700">{metrics.conferenceAloneCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Types Pie Chart */}
        <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
          <h3 className="text-lg font-bold font-serif text-brand-text mb-4">Registration Breakdown</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={regTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {regTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Author Types Pie Chart */}
        <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
          <h3 className="text-lg font-bold font-serif text-brand-text mb-4">Author Categories</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={authorTypeData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {authorTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Revenue Bar Chart */}
      <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/10 p-4">
        <h3 className="text-lg font-bold font-serif text-brand-text mb-4">Revenue by Category (₹)</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={revenueData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `₹${value.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="Scopus Proceedings" fill="#8884d8" />
              <Bar dataKey="Conference Alone" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Revenue Text Summary */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Indian - Scopus</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.indianScopusINR, '₹')}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Indian - Conf Alone</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.indianAloneINR, '₹')}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Industry - Scopus</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.industryScopusINR, '₹')}</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Industry - Conf Alone</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.industryAloneINR, '₹')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
