import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getSettings, updateSettings } from '@/lib/api'; // Assuming you have these api functions

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
    const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);

    // Fetch store settings using React Query
    const { data: settings, isLoading, isError } = useQuery({
        queryKey: ['storeSettings'],
        queryFn: getSettings,
    });

    // Update local state when data is fetched
    useEffect(() => {
        if (settings?.data?.operatingHours) {
            // Sort by dayOfWeek to ensure consistent order
            const sortedHours = [...settings.data.operatingHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
            setOperatingHours(sortedHours);
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
            // Assuming timezone is part of the settings data and doesn't change here
            timezone: settings?.data?.timezone,
            operatingHours,
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
