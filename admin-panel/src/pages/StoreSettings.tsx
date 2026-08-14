import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, Upload, Trash2, GripVertical } from 'lucide-react';
import { getSettings, updateSettings, uploadAPI } from '@/lib/api';
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

interface HeroSlide {
    image: string;
    alt: string;
    tagline: string;
    title: string;
    subtitle: string;
    buttonText: string;
    buttonLink: string;
    order: number;
}

const DEFAULT_SLIDES: HeroSlide[] = [
    {
        image: '/images/slide-1-wine.jpg',
        alt: 'Premium Wine',
        tagline: 'Premium Collection',
        title: 'Natural & Premium Wines',
        subtitle: 'Curated Selection for Every Occasion',
        buttonText: 'Shop Wine',
        buttonLink: '/category/wine',
        order: 0,
    },
    {
        image: '/images/slide-2-cocktail.jpg',
        alt: 'Premium Cocktails',
        tagline: 'Top Shelf Selection',
        title: 'Elevate Your Spirits',
        subtitle: 'Premium Tequila, Vodka & Mixers',
        buttonText: 'Shop Spirits',
        buttonLink: '/products',
        order: 1,
    },
    {
        image: '/images/slide-3-beer.jpg',
        alt: 'Cold Beers',
        tagline: 'Ice Cold Selection',
        title: 'Game Night Ready',
        subtitle: 'Cold Beers & Your Favorite Snacks',
        buttonText: 'Shop Beer',
        buttonLink: '/products',
        order: 2,
    },
    {
        image: '/images/slide-4-delivery-new.jpg',
        alt: 'Fast Delivery',
        tagline: 'Fast & Reliable',
        title: 'Premium Drinks, Delivered Fast',
        subtitle: 'Your Favorite Liquor at Your Doorstep',
        buttonText: 'Order Now',
        buttonLink: '/products',
        order: 3,
    },
    {
        image: '/images/slide-5-summer.jpg',
        alt: 'Summer Drinks',
        tagline: 'Seasonal Picks',
        title: 'Taste the Summer',
        subtitle: 'Ice-Cold Beers & Hard Seltzers',
        buttonText: 'Refresh Now',
        buttonLink: '/products',
        order: 4,
    },
];

const StoreSettings = () => {
    const queryClient = useQueryClient();
    const [timezone, setTimezone] = useState('America/Los_Angeles');
    const [taxRate, setTaxRate] = useState(0.0775);
    const [defaultDeliveryFee, setDefaultDeliveryFee] = useState(0);
    const [deliveryFeesByZip, setDeliveryFeesByZip] = useState<{ zip: string; fee: number }[]>([]);
    const [operatingHours, setOperatingHours] = useState<OperatingHour[]>([]);
    const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(DEFAULT_SLIDES);
    const [uploadingSlideIndex, setUploadingSlideIndex] = useState<number | null>(null);

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
        if (settings?.data?.data?.taxRate !== undefined) {
            setTaxRate(settings.data.data.taxRate);
        }
        if (settings?.data?.data?.defaultDeliveryFee !== undefined) {
            setDefaultDeliveryFee(settings.data.data.defaultDeliveryFee);
        }
        if (settings?.data?.data?.deliveryFeesByZip) {
            setDeliveryFeesByZip(settings.data.data.deliveryFeesByZip);
        }
        if (settings?.data?.data?.heroSlides) {
            const slides = Array.isArray(settings.data.data.heroSlides) && settings.data.data.heroSlides.length > 0
                ? settings.data.data.heroSlides
                : DEFAULT_SLIDES;
            setHeroSlides(slides.map((s: any, i: number) => ({ ...s, order: typeof s.order === 'number' ? s.order : i })));
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
            taxRate,
            defaultDeliveryFee,
            deliveryFeesByZip,
            heroSlides: heroSlides.map((slide, index) => ({ ...slide, order: index })),
        };
        mutation.mutate(payload);
    };

    const updateSlide = (index: number, field: keyof HeroSlide, value: string | number) => {
        setHeroSlides(prev => prev.map((slide, i) => i === index ? { ...slide, [field]: value } : slide));
    };

    const handleImageUpload = async (index: number, file: File) => {
        setUploadingSlideIndex(index);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const response = await uploadAPI.uploadImage(formData);
            const imageUrl = response.data?.url || response.data?.data?.url || response.data?.secure_url;
            if (!imageUrl) {
                throw new Error('Upload response did not contain a URL.');
            }
            updateSlide(index, 'image', imageUrl);
            toast.success('Hero image uploaded successfully');
        } catch (error: any) {
            toast.error('Failed to upload image', {
                description: error.response?.data?.message || error.message,
            });
        } finally {
            setUploadingSlideIndex(null);
        }
    };

    const addSlide = () => {
        setHeroSlides(prev => [...prev, { image: '', alt: '', tagline: '', title: '', subtitle: '', buttonText: '', buttonLink: '', order: prev.length }]);
    };

    const removeSlide = (index: number) => {
        setHeroSlides(prev => prev.filter((_, i) => i !== index));
    };

    const moveSlide = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === heroSlides.length - 1) return;
        setHeroSlides(prev => {
            const newSlides = [...prev];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
            return newSlides;
        });
    };

    const addZipFee = () => {
        setDeliveryFeesByZip(prev => [...prev, { zip: '', fee: 0 }]);
    };

    const removeZipFee = (index: number) => {
        setDeliveryFeesByZip(prev => prev.filter((_, i) => i !== index));
    };

    const updateZipFee = (index: number, field: 'zip' | 'fee', value: string | number) => {
        setDeliveryFeesByZip(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
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
                <CardTitle>Store Settings</CardTitle>
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

                    {/* Tax Rate */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-500">Sales Tax Rate</label>
                        <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            max="1"
                            value={taxRate}
                            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                            className="w-full md:w-[300px]"
                        />
                        <p className="text-xs text-gray-500">Default is 0.0775 (7.75% for Newport Beach, CA)</p>
                    </div>

                    {/* Default Delivery Fee */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-500">Default Delivery Fee ($)</label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={defaultDeliveryFee}
                            onChange={(e) => setDefaultDeliveryFee(parseFloat(e.target.value) || 0)}
                            className="w-full md:w-[300px]"
                        />
                        <p className="text-xs text-gray-500">Used when no zip-specific fee is found.</p>
                    </div>

                    {/* Delivery Fees by Zip */}
                    <div className="flex flex-col space-y-2">
                        <label className="text-sm font-medium text-gray-500">Delivery Fees by Zip Code</label>
                        {deliveryFeesByZip.map((row, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    type="text"
                                    placeholder="Zip Code"
                                    value={row.zip}
                                    onChange={(e) => updateZipFee(index, 'zip', e.target.value)}
                                    className="w-32"
                                />
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Fee $"
                                    value={row.fee}
                                    onChange={(e) => updateZipFee(index, 'fee', parseFloat(e.target.value) || 0)}
                                    className="w-32"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeZipFee(index)}
                                >
                                    Remove
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addZipFee}
                        >
                            + Add Zip Fee
                        </Button>
                    </div>

                    {/* Hero Slides */}
                    <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Homepage Hero Slides</h3>
                            <Button type="button" variant="outline" size="sm" onClick={addSlide}>
                                + Add Slide
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Images are uploaded to Cloudinary. Button links can be absolute URLs (https://...) or internal paths (/products).
                        </p>
                        <div className="space-y-4">
                            {heroSlides.map((slide, index) => (
                                <div key={index} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <GripVertical className="h-5 w-5 text-gray-400" />
                                            <span className="font-medium">Slide {index + 1}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => moveSlide(index, 'up')}
                                                disabled={index === 0}
                                            >
                                                Up
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => moveSlide(index, 'down')}
                                                disabled={index === heroSlides.length - 1}
                                            >
                                                Down
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => removeSlide(index)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-500">Image</label>
                                            {slide.image ? (
                                                <div className="relative">
                                                    <img
                                                        src={slide.image}
                                                        alt={slide.alt || `Slide ${index + 1}`}
                                                        className="w-full h-40 object-cover rounded-md border"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        size="sm"
                                                        className="absolute bottom-2 right-2"
                                                        onClick={() => updateSlide(index, 'image', '')}
                                                    >
                                                        Replace
                                                    </Button>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                                                    <div className="flex flex-col items-center justify-center text-gray-500">
                                                        <Upload className="h-6 w-6 mb-2" />
                                                        <span className="text-sm">Click to upload image</span>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleImageUpload(index, file);
                                                            e.target.value = '';
                                                        }}
                                                        disabled={uploadingSlideIndex === index}
                                                    />
                                                </label>
                                            )}
                                            {uploadingSlideIndex === index && (
                                                <p className="text-sm text-primary flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-500">Alt Text</label>
                                            <Input
                                                value={slide.alt}
                                                onChange={(e) => updateSlide(index, 'alt', e.target.value)}
                                                placeholder="e.g. Premium Wine"
                                            />
                                            <label className="text-sm font-medium text-gray-500">Tagline</label>
                                            <Input
                                                value={slide.tagline}
                                                onChange={(e) => updateSlide(index, 'tagline', e.target.value)}
                                                placeholder="e.g. Premium Collection"
                                            />
                                            <label className="text-sm font-medium text-gray-500">Title</label>
                                            <Input
                                                value={slide.title}
                                                onChange={(e) => updateSlide(index, 'title', e.target.value)}
                                                placeholder="e.g. Natural & Premium Wines"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-500">Subtitle</label>
                                            <Input
                                                value={slide.subtitle}
                                                onChange={(e) => updateSlide(index, 'subtitle', e.target.value)}
                                                placeholder="e.g. Curated Selection for Every Occasion"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-500">Button Text</label>
                                            <Input
                                                value={slide.buttonText}
                                                onChange={(e) => updateSlide(index, 'buttonText', e.target.value)}
                                                placeholder="e.g. Shop Wine"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-500">Button Link</label>
                                        <Input
                                            value={slide.buttonLink}
                                            onChange={(e) => updateSlide(index, 'buttonLink', e.target.value)}
                                            placeholder="e.g. /category/wine"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
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
