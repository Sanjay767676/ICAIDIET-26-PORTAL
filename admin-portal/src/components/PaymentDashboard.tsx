import React, { useMemo } from 'react';
import Chart from 'react-apexcharts';

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

  // ApexCharts Configs
  const commonPieOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'inherit',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      width: 0,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
              fontFamily: 'inherit',
              fontWeight: 600,
            },
            value: {
              show: true,
              fontSize: '24px',
              fontFamily: 'inherit',
              fontWeight: 700,
            }
          }
        }
      }
    },
    legend: {
      position: 'bottom',
      fontFamily: 'inherit',
      fontWeight: 500,
      markers: {
        size: 8,
      },
    },
    tooltip: {
      theme: 'light',
      style: {
        fontSize: '13px',
        fontFamily: 'inherit',
      },
    },
  };

  const regSeries = [metrics.scopusCount, metrics.conferenceAloneCount];
  const regOptions: ApexCharts.ApexOptions = {
    ...commonPieOptions,
    labels: ['Scopus Proceedings', 'Conference Alone'],
    colors: ['#3b82f6', '#10b981'], // Modern Blue & Emerald
  };

  const authSeries = [metrics.indianAuthorCount, metrics.industryCount, metrics.othersCount];
  const authOptions: ApexCharts.ApexOptions = {
    ...commonPieOptions,
    labels: ['Indian Author', 'Industry', 'Others'],
    colors: ['#f59e0b', '#8b5cf6', '#94a3b8'], // Modern Amber, Violet, Slate
  };

  const barSeries = [
    {
      name: 'Scopus Proceedings',
      data: [metrics.indianScopusINR, metrics.industryScopusINR]
    },
    {
      name: 'Conference Alone',
      data: [metrics.indianAloneINR, metrics.industryAloneINR]
    }
  ];

  const barOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      fontFamily: 'inherit',
      toolbar: {
        show: false,
      },
      animations: {
        enabled: true,
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 4,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: ['Indian Author', 'Industry Delegate'],
      labels: {
        style: {
          fontFamily: 'inherit',
          fontWeight: 500,
        }
      }
    },
    yaxis: {
      labels: {
        formatter: (value) => {
          if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
          if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
          return `₹${value}`;
        },
        style: {
          fontFamily: 'inherit',
        }
      }
    },
    colors: ['#3b82f6', '#10b981'],
    fill: {
      opacity: 1
    },
    tooltip: {
      theme: 'light',
      y: {
        formatter: (val) => formatCurrency(val, '₹')
      },
      style: {
        fontFamily: 'inherit',
      }
    },
    legend: {
      position: 'top',
      fontFamily: 'inherit',
      fontWeight: 500,
      markers: {
        size: 8,
      },
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-5 transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            Total Amount (₹)
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-gray-900">{formatCurrency(metrics.totalINR, '₹')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-5 transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            Total Amount ($)
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-gray-900">{formatCurrency(metrics.totalUSD, '$')}</div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-5 transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            Scopus Registrations
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-gray-900">{metrics.scopusCount}</div>
        </div>
        <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 p-5 transition-transform hover:-translate-y-1 duration-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            Conference Alone
          </div>
          <div className="text-3xl font-bold font-sans tracking-tight text-gray-900">{metrics.conferenceAloneCount}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration Types Chart */}
        <div className="bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50 p-6">
          <h3 className="text-lg font-bold font-sans text-gray-900 mb-6">Registration Breakdown</h3>
          <div className="h-[300px]">
            <Chart options={regOptions} series={regSeries} type="donut" height="100%" />
          </div>
        </div>

        {/* Author Types Chart */}
        <div className="bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50 p-6">
          <h3 className="text-lg font-bold font-sans text-gray-900 mb-6">Author Categories</h3>
          <div className="h-[300px]">
            <Chart options={authOptions} series={authSeries} type="donut" height="100%" />
          </div>
        </div>
      </div>

      {/* Detailed Revenue Chart */}
      <div className="bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-50 p-6">
        <h3 className="text-lg font-bold font-sans text-gray-900 mb-6">Revenue by Category (₹)</h3>
        <div className="h-[350px]">
          <Chart options={barOptions} series={barSeries} type="bar" height="100%" />
        </div>
        
        {/* Revenue Text Summary */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Indian - Scopus</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(metrics.indianScopusINR, '₹')}</div>
          </div>
          <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Indian - Conf Alone</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(metrics.indianAloneINR, '₹')}</div>
          </div>
          <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Industry - Scopus</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(metrics.industryScopusINR, '₹')}</div>
          </div>
          <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Industry - Conf Alone</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(metrics.industryAloneINR, '₹')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
