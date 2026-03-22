import React, { useEffect, useState } from 'react';
import { newsletterAPI } from '../lib/api';
import { Mail, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';

const Newsletters: React.FC = () => {
    const [newsletters, setNewsletters] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNewsletters();
    }, []);

    const fetchNewsletters = async () => {
        try {
            setLoading(true);
            const response = await newsletterAPI.getNewsletters();
            if (response.data.success) {
                setNewsletters(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching newsletters:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        const headers = ['Email', 'Subscribed Date'];
        const csvContent = [
            headers.join(','),
            ...newsletters.map(n => `"${n.email}","${format(new Date(n.createdAt), 'yyyy-MM-dd HH:mm:ss')}"`)
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `newsletter_subscribers_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Newsletter Subscribers</h1>
                <button
                    onClick={exportToCSV}
                    disabled={newsletters.length === 0}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition-colors"
                >
                    <Download size={20} />
                    Export CSV
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="px-6 py-4 font-semibold text-gray-600">Email Address</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Subscribed At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="border-b animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-48"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                                    </tr>
                                ))
                            ) : newsletters.length > 0 ? (
                                newsletters.map((item) => (
                                    <tr key={item._id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-full">
                                                    <Mail size={18} />
                                                </div>
                                                <span className="text-gray-800 font-medium">{item.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar size={16} />
                                                {format(new Date(item.createdAt), 'MMM dd, yyyy HH:mm')}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={2} className="px-6 py-10 text-center text-gray-500">
                                        No subscribers found yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Newsletters;
