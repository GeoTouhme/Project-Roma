import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getSettings, updateSettings } from '@/lib/api'; // Assuming you have these api functions
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Define US timezones
const US_TIMEZONES = [
    { value: 'America/New_York', label: 'Eastern Time (New York)' },
    { value: 'America/Chicago', label: 'Central Time (Chicago)' },
    { value: 'America/Denver', label: 'Mountain Time (Denver)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
    { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
    { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
];

// Define the type for a single day's operating hours
interface OperatingHour {
    dayOfWeek: number;
    day: string;
    isOpen: boolean;
    open: string;
    close: string;
}

const StoreSettings = () => {
    const queryClient = useQueryClient();
    const [timezone, setTimezone] = useState('America/Los_Angeles');
    const [deliveryProvider, setDeliveryProvider] = useState('doordash');
    const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);

    // Fetch store settings using React Query
    const { data: settings, isLoading, isError } = useQuery({
        queryKey: ['storeSettings'],
        queryFn: getSettings,
    });

    // Update local state when data is fetched
    useEffect(() => {
        if (settings?.data?.data?.operatingHours) {
            // Sort by dayOfWeek to ensure consistent order
            const sortedHours = [...settings.data.data.operatingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
            setOperatingHours(sortedHours);
        }
        if (settings?.data?.data?.timezone) {
            setTimezone(settings.data.data.timezone);
        }
        if (settings?.data?.data?.deliveryProvider) {
            setDeliveryProvider(settings.data.data.deliveryProvider);
        }
    }, [settings]);

    // Mutation for updating settings
    const mutation = useMutation({
        mutationFn: updateSettings,
        onSuccess: () => {
            toast.success("Store settings updated successfully!");
            queryClient.invalidateQueries({ queryKey: ['storeSettings'] });
        },
        onError: (error: any) => {
            toast.error("Failed to update settings", {
                description: error.response?.data?.message || error.message,
            });
        }
    });

    const handleHourChange = (dayOfWeek: number, field: keyof OperatingHour, value: string | boolean) => {
        setOperatingHours(prevHours =>
            prevHours.map(hour =>
                hour.dayOfWeek === dayOfWeek ? { ...hour, [field]: value } : hour
            )
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            timezone,
            operatingHours,
            deliveryProvider,
        };
        mutation.mutate(payload);
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Loading Store Settings...</p>
        </div>;
    }

    if (isError) {
        return <div className="text-red-500 text-center p-8">Error loading store settings. Please try again later.</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Store Operating Hours</CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    {/* Timezone Selector */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-500">Store Timezone</label>
                        <Select value={timezone} onValueChange={setTimezone}>
                            <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                {US_TIMEZONES.map((tz) => (
                                    <SelectItem key={tz.value} value={tz.value}>
                                        {tz.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Delivery Provider Selector */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-500">Delivery Provider</label>
                        <Select value={deliveryProvider} onValueChange={setDeliveryProvider}>
                            <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="doordash">DoorDash</SelectItem>
                                <SelectItem value="uberdirect">Uber Direct</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Operating Hours */}
                    <div className="border-t pt-4">
                        <h3 className="text-lg font-semibold mb-4">Operating Hours</h3>
                        {operatingHours.map(hour => (
                            <div key={hour.dayOfWeek} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center p-3 border rounded-lg">
                                <div className="md:col-span-1 flex items-center">
                                    <Checkbox
                                        id={`isOpen-${hour.dayOfWeek}`}
                                        checked={hour.isOpen}
                                        onCheckedChange={(checked) => handleHourChange(hour.dayOfWeek, 'isOpen', !!checked)}
                                        className="mr-3"
                                    />
                                    <label htmlFor={`isOpen-${hour.dayOfWeek}`} className="font-semibold text-md">{hour.day}</label>
                                </div>
                                <div className="md:col-span-1">
                                    <label htmlFor={`open-${hour.dayOfWeek}`} className="text-sm font-medium text-gray-500">Open Time</label>
                                    <Input
                                        id={`open-${hour.dayOfWeek}`}
                                        type="time"
                                        value={hour.open}
                                        onChange={(e) => handleHourChange(hour.dayOfWeek, 'open', e.target.value)}
                                        disabled={!hour.isOpen}
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label htmlFor={`close-${hour.dayOfWeek}`} className="text-sm font-medium text-gray-500">Close Time</label>
                                    <Input
                                        id={`close-${hour.dayOfWeek}`}
                                        type="time"
                                        value={hour.close}
                                        onChange={(e) => handleHourChange(hour.dayOfWeek, 'close', e.target.value)}
                                        disabled={!hour.isOpen}
                                    />
                                </div>
                                <div className="md:col-span-1 text-xs text-gray-400">
                                    {hour.open > hour.close && "(Closes next day)"}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
};

export default StoreSettings;
