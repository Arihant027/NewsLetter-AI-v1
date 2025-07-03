// src/pages/UserDashboard.tsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { fetchWithToken, fetchBlobWithToken } from '@/lib/api';
import { toast } from 'sonner';

import { AdminHeader } from '@/components/AdminHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Loader2, Calendar as CalendarIcon, AlertCircle, Bookmark, Newspaper, Send, Download, FileText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// --- Data Types ---
interface ReceivedNewsletter {
  _id: string;
  title: string;
  category: string;
  createdAt: string;
}
interface Category {
  _id: string;
  name: string;
}
interface UserProfile {
  name: string;
  email: string;
  categories: string[];
}

// This should match the structure of the `user` object in AuthContext
interface User {
  id: string;
  name: string;
  email: string;
  userType: 'user' | 'admin' | 'superadmin';
  categories: string[];
}

const preferencesSchema = z.object({
  email: z.string().email("Invalid email address."),
  categories: z.array(z.string()).default([]),
});
type PreferencesFormData = z.infer<typeof preferencesSchema>;

const fetchAllCategories = (token: string | null): Promise<Category[]> => fetchWithToken('/categories', token);
const fetchUserProfile = (token: string | null): Promise<UserProfile> => fetchWithToken('/users/me', token);

const updateUserProfile = async (token: string | null, data: Partial<PreferencesFormData>) => {
    const { email, categories } = data;
    const promises = [];

    if (email) {
        promises.push(fetchWithToken('/users/me/profile', token, { method: 'PATCH', body: JSON.stringify({ email }) }));
    }

    if (categories) {
        promises.push(fetchWithToken('/users/me/categories', token, { method: 'PATCH', body: JSON.stringify({ categories }) }));
    }

    const responses = await Promise.all(promises);
    
    // If the email was updated, a new token is returned.
    const profileResponse = responses.find(r => r.token);
    if(profileResponse) {
        return profileResponse;
    }

    // If only categories were updated, we need to fetch the user again to get the updated data
    const userResponse = await fetchUserProfile(token);
    return { user: userResponse, token };
};


const UserDashboard = () => {
    const { user, token, login } = useAuth();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'newsletters');
    
    const { control, handleSubmit, reset, formState: { isSubmitting, isDirty } } = useForm<PreferencesFormData>({
        resolver: zodResolver(preferencesSchema),
        defaultValues: {
            email: user?.email || '',
            categories: user?.categories || []
        }
    });

    const { data: allCategories, isLoading: isLoadingCategories, error: categoriesError } = useQuery({ 
        queryKey: ['allCategories'], 
        queryFn: () => fetchAllCategories(token), 
        enabled: !!token,
    });
    const { data: userProfile } = useQuery({ 
        queryKey: ['userProfile'], 
        queryFn: () => fetchUserProfile(token),
        enabled: !!token,
    });
    const { data: receivedNewsletters, isLoading: isLoadingNewsletters } = useQuery<ReceivedNewsletter[], Error>({
        queryKey: ['myReceivedNewsletters'],
        queryFn: () => fetchWithToken('/users/my-newsletters', token),
        enabled: !!token,
        refetchInterval: 15000,
        refetchOnWindowFocus: true,
    });

    const updateProfileMutation = useMutation({
        mutationFn: (data: PreferencesFormData) => updateUserProfile(token, data),
        onSuccess: (data) => { 
            toast.success("Profile updated successfully!"); 
            if (data.token) {
              login(data.user, data.token);
            }
            queryClient.invalidateQueries({ queryKey: ['userProfile'] });
            reset({ email: data.user.email, categories: data.user.categories || [] });
        },
        onError: (err: Error) => { toast.error(err.message || "Failed to save preferences."); }
    });
    
    const downloadPdfMutation = useMutation({
        mutationFn: ({ newsletterId, title }: { newsletterId: string, title: string }) => fetchBlobWithToken(`/newsletters/${newsletterId}/download`, token).then(blob => ({ blob, title })),
        onSuccess: ({ blob, title }) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/\s/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success("PDF downloaded successfully!");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to download PDF."),
    });

    const viewPdfMutation = useMutation({
        mutationFn: (newsletterId: string) => fetchBlobWithToken(`/newsletters/${newsletterId}/download`, token),
        onSuccess: (blob) => {
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.success("PDF opened successfully!");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to open PDF."),
    });

    const sendToEmailMutation = useMutation({
        mutationFn: (newsletterId: string) => fetchWithToken(
            '/users/send-newsletter-to-self',
            token,
            {
                method: 'POST',
                body: JSON.stringify({ newsletterId })
            }
        ),
        onSuccess: (data: { message: string }) => {
            toast.success(data.message || "Newsletter sent to your email!");
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['myReceivedNewsletters'] });
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to send the newsletter.");
        },
    });

    useEffect(() => {
        if (userProfile) {
            reset({ email: userProfile.email, categories: userProfile.categories || [] });
        }
    }, [userProfile, reset]);
    
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        if (tabFromUrl) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    const onSubmitPreferences = (data: PreferencesFormData) => {
        updateProfileMutation.mutate(data);
    };

    const filteredNewsletters = useMemo(() => {
        if (!receivedNewsletters) return [];
        if (!filterDate) return receivedNewsletters;
        const selectedDateStr = filterDate.toDateString();
        return receivedNewsletters.filter(newsletter => 
            new Date(newsletter.createdAt).toDateString() === selectedDateStr
        );
    }, [receivedNewsletters, filterDate]);

    return (
        <div className="min-h-screen bg-background">
            <AdminHeader />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <div className="flex justify-center">
                        <TabsList>
                            <TabsTrigger value="newsletters">My Newsletters</TabsTrigger>
                            <TabsTrigger value="subscriptions">My Subscriptions</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="newsletters" className="mt-6">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2"><Newspaper />My Newsletter Library</CardTitle>
                                        <CardDescription>Here are all the newsletters you have received.</CardDescription>
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button id="date" variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal",!filterDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {filterDate ? format(filterDate, "PPP") : <span>Filter by date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar initialFocus mode="single" selected={filterDate} onSelect={setFilterDate} />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {isLoadingNewsletters ? (
                                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
                                ) : !filteredNewsletters || filteredNewsletters.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8">
                                        {filterDate ? "No newsletters found for this date." : "You haven't received any newsletters yet."}
                                    </p>
                                ) : (
                                    filteredNewsletters.map((newsletter) => (
                                        <div key={newsletter._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent">
                                            <div>
                                                <h3 className="font-semibold">{newsletter.title}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    Category: {newsletter.category} | Received: {format(new Date(newsletter.createdAt), 'PP')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" onClick={() => viewPdfMutation.mutate(newsletter._id)} disabled={viewPdfMutation.isPending && viewPdfMutation.variables === newsletter._id}>
                                                    {viewPdfMutation.isPending && viewPdfMutation.variables === newsletter._id 
                                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        : <FileText className="w-4 h-4 mr-2" />
                                                    }
                                                    View PDF
                                                </Button>
                                                <Button variant="outline" onClick={() => downloadPdfMutation.mutate({ newsletterId: newsletter._id, title: newsletter.title })} disabled={downloadPdfMutation.isPending && downloadPdfMutation.variables?.newsletterId === newsletter._id}>
                                                    {downloadPdfMutation.isPending && downloadPdfMutation.variables?.newsletterId === newsletter._id 
                                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        : <Download className="w-4 h-4 mr-2" />
                                                    }
                                                    Download PDF
                                                </Button>
                                                <Button variant="outline" onClick={() => sendToEmailMutation.mutate(newsletter._id)} disabled={sendToEmailMutation.isPending && sendToEmailMutation.variables === newsletter._id}>
                                                    {sendToEmailMutation.isPending && sendToEmailMutation.variables === newsletter._id
                                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        : <Send className="w-4 h-4 mr-2" />
                                                    }
                                                    Send to Email
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="subscriptions" className="mt-6">
                       <form onSubmit={handleSubmit(onSubmitPreferences)}>
                            <Card>
                                <CardHeader>
                                  <CardTitle className="flex items-center gap-2"><Bookmark />Manage My Subscriptions</CardTitle>
                                  <CardDescription>Update your email or select topics to receive tailored newsletters.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div>
                                        <Label htmlFor="email" className="text-base font-semibold">Email Address</Label>
                                        <p className="text-sm text-muted-foreground mb-2">You can update the email address where you receive newsletters.</p>
                                        <Controller
                                            name="email"
                                            control={control}
                                            render={({ field }) => <Input id="email" type="email" {...field} className="max-w-sm"/>}
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-base font-semibold">Categories</Label>
                                        <p className="text-sm text-muted-foreground mb-2">Choose the topics that interest you.</p>
                                        {isLoadingCategories ? (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                                            </div>
                                        ) : categoriesError ? (
                                            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{categoriesError.message}</AlertDescription></Alert>
                                        ) : (!allCategories || allCategories.length === 0) ? (
                                            <p className="text-center text-muted-foreground py-8">No categories have been added to the system yet.</p>
                                        ) : (
                                            <Controller
                                                name="categories"
                                                control={control}
                                                render={({ field }) => (
                                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                                        {allCategories?.map((category) => (
                                                            <div key={category._id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent">
                                                                <Checkbox
                                                                    id={category._id}
                                                                    checked={field.value?.includes(category.name)}
                                                                    onCheckedChange={(checked) => {
                                                                        const newValue = checked
                                                                            ? [...(field.value || []), category.name]
                                                                            : (field.value || []).filter((value) => value !== category.name);
                                                                        field.onChange(newValue);
                                                                    }}
                                                                />
                                                                <label htmlFor={category._id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{category.name}</label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            />
                                        )}
                                    </div>
                                </CardContent>
                                <CardContent>
                                    <Button type="submit" disabled={isSubmitting || !isDirty}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Save Preferences
                                    </Button>
                                </CardContent>
                            </Card>
                        </form>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default UserDashboard;