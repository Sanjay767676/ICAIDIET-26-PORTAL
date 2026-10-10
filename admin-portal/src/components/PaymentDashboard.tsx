import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

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

const parseAmount = (feeStr: string | null | undefined): { val: number; currency: string } => {
  if (!feeStr) return { val: 0, currency: '₹' };
  const str = feeStr.trim();
  const currency = str.includes('$') ? '$' : '₹';
  const val = parseFloat(str.replace(/[^0-9.]/g, ''));
  return { val: isNaN(val) ? 0 : val, currency };
};

const formatCurrency = (amount: number, currency: string) => {
  // Use en-IN for Indian Rupee format (e.g., 12,00,000)
  if (currency === '₹') {
    return `${currency}${amount.toLocaleString('en-IN')}`;
  }
  return `${currency}${amount.toLocaleString('en-US')}`;
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
      othersCount: payments.length - indianAuthorCount - industryCount,
      totalINR,
      totalUSD,
      indianScopusINR,
      indianAloneINR,
      industryScopusINR,
      industryAloneINR,
    };
  }, [payments]);

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const regTypeData = {
    labels: ['Scopus Proceedings', 'Conference Alone'],
    datasets: [
      {
        data: [metrics.scopusCount, metrics.conferenceAloneCount],
        backgroundColor: ['rgba(54, 162, 235, 0.8)', 'rgba(75, 192, 192, 0.8)'],
        borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)'],
        borderWidth: 1,
      },
    ],
  };

  const authorTypeData = {
    labels: ['Indian Author', 'Industry', 'Others'],
    datasets: [
      {
        data: [metrics.indianAuthorCount, metrics.industryCount, metrics.othersCount],
        backgroundColor: ['rgba(255, 159, 64, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(201, 203, 207, 0.8)'],
        borderColor: ['rgba(255, 159, 64, 1)', 'rgba(153, 102, 255, 1)', 'rgba(201, 203, 207, 1)'],
        borderWidth: 1,
      },
    ],
  };

  const barData = {
    labels: ['Indian Author', 'Industry Delegate'],
    datasets: [
      {
        label: 'Scopus Proceedings',
        data: [metrics.indianScopusINR, metrics.industryScopusINR],
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
      },
      {
        label: 'Conference Alone',
        data: [metrics.indianAloneINR, metrics.industryAloneINR],
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y, '₹');
            }
            return label;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-500 mb-1">Total Amount (₹)</div>
          <div className="text-2xl font-bold font-serif text-green-700">{formatCurrency(metrics.totalINR, '₹')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-500 mb-1">Total Amount ($)</div>
          <div className="text-2xl font-bold font-serif text-blue-700">{formatCurrency(metrics.totalUSD, '$')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-500 mb-1">Scopus Registrations</div>
          <div className="text-2xl font-bold font-serif text-purple-700">{metrics.scopusCount}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-500 mb-1">Conference Alone</div>
          <div className="text-2xl font-bold font-serif text-amber-700">{metrics.conferenceAloneCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Types Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-bold font-serif text-gray-800 mb-4">Registration Breakdown</h3>
          <div className="h-[300px] relative">
            <Pie data={regTypeData} options={pieOptions} />
          </div>
        </div>

        {/* Author Types Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="text-lg font-bold font-serif text-gray-800 mb-4">Author Categories</h3>
          <div className="h-[300px] relative">
            <Pie data={authorTypeData} options={pieOptions} />
          </div>
        </div>
      </div>

      {/* Detailed Revenue Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-bold font-serif text-gray-800 mb-4">Revenue by Category (₹)</h3>
        <div className="h-[400px] relative">
          <Bar data={barData} options={barOptions} />
        </div>
        
        {/* Revenue Text Summary */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Indian - Scopus</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.indianScopusINR, '₹')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Indian - Conf Alone</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.indianAloneINR, '₹')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Industry - Scopus</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.industryScopusINR, '₹')}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-500 font-semibold uppercase">Industry - Conf Alone</div>
            <div className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(metrics.industryAloneINR, '₹')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
