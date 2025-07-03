import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Clock, CheckCircle, Users, ListTodo, Newspaper, AlertCircle, XCircle, ExternalLink, Sparkles, Loader2, Save, FileSignature, Trash2, Share2, Calendar as CalendarIcon, Plus, Copy, UserPlus, ChevronsUpDown, CheckCheck, Download, Mail } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminHeader } from '@/components/AdminHeader';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { fetchWithToken, fetchBlobWithToken } from '@/lib/api';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useSearchParams } from 'react-router-dom';

// --- Data Types ---
interface Newsletter { _id: string; title: string; category: string; status: 'Not Sent' | 'pending' | 'approved' | 'declined' | 'sent'; articles: { _id: string }[]; createdAt: string; }
interface Subscriber { _id: string; name: string; email: string; categories: string[]; }
interface CategoryStat { name: string; subscriberCount: number; newsletterCount: number; }
interface NewsArticle { source: { name: string; }; title: string; description: string; url: string; urlToImage: string; content: string; summary?: string; }
interface CuratedArticle { _id: string; title: string; summary: string; sourceName: string; category: string; originalUrl: string; imageUrl?: string;}
interface SystemCategory { _id: string; name: string; }

// --- Zod Schema for the Add User form ---
const addUserSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  categories: z.array(z.string()).default([]),
});
type AddUserFormData = z.infer<typeof addUserSchema>;

const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { user, token } = useAuth();
    
    // --- State Management ---
    const [activeTab, setActiveTab] = useState<string | null>(searchParams.get('tab'));
    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    const [summarizedArticles, setSummarizedArticles] = useState<Record<string, string>>({});
    const [selectedRawArticles, setSelectedRawArticles] = useState<NewsArticle[]>([]);
    const [selectedCuratedArticles, setSelectedCuratedArticles] = useState<CuratedArticle[]>([]);
    const [newsletterTitle, setNewsletterTitle] = useState("");
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [sharingNewsletter, setSharingNewsletter] = useState<Newsletter | null>(null);
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [isCurationDialogOpen, setIsCurationDialogOpen] = useState(false);
    const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
    const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
    const [isAddExistingUserDialogOpen, setIsAddExistingUserDialogOpen] = useState(false);
    const [isPdfTitleDialogOpen, setIsPdfTitleDialogOpen] = useState(false);
    const [usersToAdd, setUsersToAdd] = useState<string[]>([]);
    const [createdUserInfo, setCreatedUserInfo] = useState<{ name: string; email: string; password_was: string } | null>(null);
    const [shareSearchTerm, setShareSearchTerm] = useState('');
    const [articleFilter, setArticleFilter] = useState('all');
    const [categoryToAdd, setCategoryToAdd] = useState<string>('');

    const addUserForm = useForm<AddUserFormData>({ resolver: zodResolver(addUserSchema), defaultValues: { name: "", email: "", categories: [] } });

    useEffect(() => {
        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        setActiveTab(tabFromUrl);
    }, [searchParams]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };
    
    // --- Data Fetching ---
    const { data: newsletters, isLoading: isLoadingNewsletters, error: newslettersError } = useQuery<Newsletter[], Error>({ queryKey: ['myNewsletters'], queryFn: () => fetchWithToken('/newsletters', token), enabled: !!token });
    const { data: subscribers, isLoading: isLoadingSubscribers, error: subscribersError } = useQuery<Subscriber[], Error>({ queryKey: ['mySubscribers'], queryFn: () => fetchWithToken('/admins/my-subscribers', token), enabled: !!token });
    const { data: categoryStats, isLoading: isLoadingCategoryStats, error: categoryStatsError } = useQuery<CategoryStat[], Error>({
        queryKey: ['myCategoryStats'],
        queryFn: () => fetchWithToken('/admins/my-categories-stats', token),
        enabled: !!token,
        refetchInterval: 20000,
    });
    const { data: newsData, isLoading: isLoadingNews, error: newsError } = useQuery<{ articles: NewsArticle[] }, Error>({ queryKey: ['newsArticles'], queryFn: () => fetchWithToken('/news', token), enabled: !!token });
    const { data: allUsers, isLoading: isLoadingAllUsers } = useQuery<Subscriber[], Error>({ queryKey: ['allUsers'], queryFn: () => fetchWithToken('/admins/all-users', token), enabled: !!token && (isShareDialogOpen || isAddExistingUserDialogOpen) });
    const { data: savedArticles, isLoading: isLoadingSaved, error: savedArticlesError } = useQuery<CuratedArticle[], Error>({ queryKey: ['savedArticles', articleFilter], queryFn: () => { const endpoint = articleFilter === 'all' ? '/articles' : `/articles?timeframe=${articleFilter}`; return fetchWithToken(endpoint, token); }, enabled: !!token });
    const { data: allSystemCategories, isLoading: isLoadingAllCategories, error: allCategoriesError } = useQuery<SystemCategory[], Error>({ queryKey: ['allSystemCategories'], queryFn: () => fetchWithToken('/categories', token), enabled: isShareDialogOpen });

    // --- Mutations ---
    const addUserMutation = useMutation<{ message: string; user: { _id: string; name: string; email: string; }; password_was: string }, Error, AddUserFormData>({
        mutationFn: (data: AddUserFormData) => fetchWithToken('/admins/add-user', token, { method: 'POST', body: JSON.stringify(data) }),
        onSuccess: (data) => {
            toast.success(data.message);
            setIsAddUserDialogOpen(false);
            setCreatedUserInfo({ ...data.user, password_was: data.password_was });
            addUserForm.reset();
        },
        onError: (err: Error) => toast.error(err.message),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['mySubscribers'] });
            queryClient.invalidateQueries({ queryKey: ['myCategoryStats'] });
        },
    });

    const addUsersToCategoryMutation = useMutation<{ message: string }, Error, { userIds: string[], category: string }>({
        mutationFn: (data) => fetchWithToken('/admins/add-users-to-category', token, { method: 'PATCH', body: JSON.stringify(data) }),
        onSuccess: (data) => {
            toast.success(data.message);
            setIsAddExistingUserDialogOpen(false);
        },
        onError: (err: Error) => toast.error(err.message),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['mySubscribers'] });
            queryClient.invalidateQueries({ queryKey: ['myCategoryStats'] });
        }
    });

    const removeUserFromCategoryMutation = useMutation<{ message: string }, Error, { userId: string, categoryName: string }>({
        mutationFn: ({ userId, categoryName }) =>
            fetchWithToken('/admins/remove-user-from-category', token, {
                method: 'PATCH',
                body: JSON.stringify({ userId, categoryName }),
            }),
        onSuccess: (data) => {
            toast.success(data.message);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['mySubscribers'] });
            queryClient.invalidateQueries({ queryKey: ['myCategoryStats'] });
        },
    });
    
    const updateStatusMutation = useMutation<Newsletter, Error, { id: string; status: 'approved' | 'declined' }>({ mutationFn: ({ id, status }) => fetchWithToken(`/newsletters/${id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status }) }), onSuccess: () => { toast.success("Newsletter status updated!"); queryClient.invalidateQueries({ queryKey: ['myNewsletters'] }); }, onError: (err: Error) => toast.error(err.message), });
    const summarizeMutation = useMutation<{ summary: string }, Error, NewsArticle>({
        mutationFn: (article: NewsArticle) => {
            const textToSummarize = `${article.title}. ${article.description || ''}`;
            return fetchWithToken('/news/summarize', token, {
                method: 'POST',
                body: JSON.stringify({ textToSummarize })
            });
        },
        onSuccess: (data, variables) => {
            setSummarizedArticles(prev => ({ ...prev, [variables.url]: data.summary }));
            toast.success("Summary generated!");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to generate summary."),
    });
    const saveMutation = useMutation<{ message: string }, Error, NewsArticle[]>({ mutationFn: (articles) => fetchWithToken('/articles', token, { method: 'POST', body: JSON.stringify({ articles }) }), onSuccess: (data) => { toast.success(data.message); setSelectedRawArticles([]); queryClient.invalidateQueries({ queryKey: ['savedArticles', 'all'] }); setArticleFilter('all');}, onError: (err: Error) => toast.error(err.message), });
    const generatePdfMutation = useMutation<Blob, Error, { articles: CuratedArticle[], title: string, category: string }>({ mutationFn: (data) => fetchBlobWithToken('/newsletters/generate-and-save', token, { method: 'POST', body: JSON.stringify(data), }), onSuccess: (blob) => { queryClient.invalidateQueries({ queryKey: ['myNewsletters'] }); setNewsletterTitle(""); const url = URL.createObjectURL(blob); window.open(url, '_blank'); toast.success("Newsletter created and opened successfully!"); setIsPdfTitleDialogOpen(false); }, onError: (err: Error) => { toast.error(err.message || "Failed to generate and save PDF."); }, });
    
    const viewPdfMutation = useMutation<Blob, Error, string>({
        mutationFn: (newsletterId) => fetchBlobWithToken(`/newsletters/${newsletterId}/download`, token),
        onSuccess: (blob) => {
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.success("PDF opened successfully!");
        },
        onError: (err: Error) => toast.error(err.message || "Failed to open PDF."),
    });

    const downloadPdfMutation = useMutation<{ blob: Blob, title: string }, Error, { newsletterId: string, title: string }>({
        mutationFn: ({ newsletterId, title }) => fetchBlobWithToken(`/newsletters/${newsletterId}/download`, token).then(blob => ({ blob, title })),
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

    const deleteNewsletterMutation = useMutation<{ message: string }, Error, string>({ mutationFn: (newsletterId) => fetchWithToken(`/newsletters/${newsletterId}`, token, { method: 'DELETE' }), onSuccess: () => { toast.success("Newsletter deleted successfully!"); queryClient.invalidateQueries({ queryKey: ['myNewsletters'] }); }, onError: (err: Error) => toast.error(err.message), });
    const deleteArticleMutation = useMutation<{ message: string }, Error, string>({ mutationFn: (articleId) => fetchWithToken(`/articles/${articleId}`, token, { method: 'DELETE' }), onSuccess: () => { toast.success("Article deleted successfully!"); setSelectedCuratedArticles([]); queryClient.invalidateQueries({ queryKey: ['savedArticles', articleFilter] }); }, onError: (err: Error) => toast.error(err.message), });
    const shareNewsletterMutation = useMutation<{ message: string }, Error, { newsletterId: string; userIds: string[] }>({ mutationFn: (data) => fetchWithToken(`/newsletters/${data.newsletterId}/send`, token, { method: 'POST', body: JSON.stringify({ userIds: data.userIds }) }), onSuccess: (data) => { toast.success(data.message); queryClient.invalidateQueries({ queryKey: ['myNewsletters'] }); setIsShareDialogOpen(false); }, onError: (err: Error) => toast.error(err.message), });
    const shareUserDetailsMutation = useMutation<{ message: string }, Error, { email: string; name: string; password_was: string }>({
        mutationFn: (data) => 
            fetchWithToken('/admins/share-new-user-details', token, {
                method: 'POST',
                body: JSON.stringify({ email: data.email, name: data.name, password: data.password_was }),
            }),
        onSuccess: (data) => {
            toast.success(data.message);
        },
        onError: (err: Error) => {
            toast.error(err.message || "Failed to share details.");
        }
    });

    // --- Event Handlers & Memoized Values ---
    const handleOpenShareDialog = (newsletter: Newsletter) => { setSelectedUserIds([]); setShareSearchTerm(''); setSharingNewsletter(newsletter); setIsShareDialogOpen(true); };
    const handleOpenAddExistingDialog = () => { setUsersToAdd([]); setIsAddExistingUserDialogOpen(true); };
    const handleCategorySelection = (categoryUsers: Subscriber[], isChecked: boolean) => { const idsForCategory = categoryUsers.map(u => u._id); const currentSelectedIds = new Set(selectedUserIds); if (isChecked) { idsForCategory.forEach(id => currentSelectedIds.add(id)); } else { idsForCategory.forEach(id => currentSelectedIds.delete(id)); } setSelectedUserIds(Array.from(currentSelectedIds)); };
    const handleSelectAllFiltered = (isSelected: boolean) => { const filteredIds = filteredAllUsers.map(u => u._id); if (isSelected) { setSelectedUserIds(prev => [...new Set([...prev, ...filteredIds])]); } else { setSelectedUserIds(prev => prev.filter(id => !filteredIds.includes(id))); } };
    const handleShareSubmit = () => { if (!sharingNewsletter || selectedUserIds.length === 0) { toast.warning("Please select at least one recipient."); return; } shareNewsletterMutation.mutate({ newsletterId: sharingNewsletter._id, userIds: Array.from(new Set(selectedUserIds)) }); };
    const handleSelectRawArticle = (article: NewsArticle, isSelected: boolean) => { setSelectedRawArticles(prev => isSelected ? [...prev, article] : prev.filter(a => a.url !== article.url)); };
    const handleSave = () => { const articlesToSave = selectedRawArticles.map(a => ({ ...a, summary: summarizedArticles[a.url] || a.description })); saveMutation.mutate(articlesToSave); };
    const handleSelectCuratedArticle = (article: CuratedArticle, isSelected: boolean) => { setSelectedCuratedArticles(prev => isSelected ? [...prev, article] : prev.filter(a => a._id !== article._id)); };
    const handleGeneratePdf = () => { if (!newsletterTitle) { toast.warning("Please enter a title."); return; } if (selectedCuratedArticles.length === 0) { toast.warning("Please select at least one article."); return; } const category = selectedCuratedArticles[0]?.category; if (!category) { toast.error("Could not determine category."); return; } generatePdfMutation.mutate({ articles: selectedCuratedArticles, title: newsletterTitle, category }); };
    
    useEffect(() => {
        if (isAddExistingUserDialogOpen && categoryStats && categoryStats.length > 0 && !categoryToAdd) {
            setCategoryToAdd(categoryStats[0].name);
        }
    }, [isAddExistingUserDialogOpen, categoryStats, categoryToAdd]);
    
    const handleAddExistingUsersSubmit = () => {
        if (usersToAdd.length === 0) {
            toast.warning("Please select at least one user to add.");
            return;
        }
        if (!categoryToAdd) {
            toast.warning("Please select a category.");
            return;
        }
        addUsersToCategoryMutation.mutate({ userIds: usersToAdd, category: categoryToAdd });
    };
    
    const assignableUsers = useMemo(() => { if (!allUsers) return []; if (!subscribers) return allUsers; const subscribedIds = new Set(subscribers.map(s => s._id)); return allUsers.filter(u => !subscribedIds.has(u._id)); }, [allUsers, subscribers]);
    const groupedUsersByCategory = useMemo(() => { if (!allUsers) return {}; return allUsers.reduce((acc, user) => { user.categories.forEach(category => { if (!acc[category]) { acc[category] = []; } acc[category].push(user); }); return acc; }, {} as Record<string, Subscriber[]>); }, [allUsers]);
    const filteredAllUsers = useMemo(() => { if (!allUsers) return []; if (!shareSearchTerm) return allUsers; return allUsers.filter(user => user.name.toLowerCase().includes(shareSearchTerm.toLowerCase()) || user.email.toLowerCase().includes(shareSearchTerm.toLowerCase())); }, [allUsers, shareSearchTerm]);
    const filteredNewsletters = useMemo(() => { if (!newsletters) return []; if (!filterDate) return newsletters; const selectedDateStr = filterDate.toDateString(); return newsletters.filter(nl => new Date(nl.createdAt).toDateString() === selectedDateStr); }, [newsletters, filterDate]);

    // --- Render Functions ---
    const getStatusProps = (status: string) => {
        switch (status) {
            case 'sent': return { color: 'bg-blue-100 text-blue-800', icon: <CheckCheck className="w-4 h-4" />, text: 'Sent' };
            case 'approved': return { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" />, text: 'Approved' };
            case 'pending': return { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" />, text: 'Pending' };
            case 'declined': return { color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" />, text: 'Declined' };
            case 'Not Sent':
            default: return { color: 'bg-gray-100 text-gray-800', icon: <Newspaper className="w-4 h-4" />, text: 'Not Sent' };
        }
    };
    const renderNewsletterList = () => { if (isLoadingNewsletters) return Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />); if (newslettersError) return <Alert variant="destructive"><AlertDescription>{newslettersError.message}</AlertDescription></Alert>; if (!filteredNewsletters || filteredNewsletters.length === 0) { return <p className="text-center text-muted-foreground py-8">{filterDate ? "No newsletters found for this date." : "No newsletters have been generated yet."}</p>; } return filteredNewsletters.map((newsletter) => { const statusProps = getStatusProps(newsletter.status); return (<div key={newsletter._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"><div className="flex-1"><div className="flex items-center gap-3 mb-2"><h3 className="font-semibold">{newsletter.title}</h3><Badge variant="outline">{newsletter.category}</Badge><Badge className={statusProps.color}>{statusProps.icon}<span className="ml-1">{statusProps.text}</span></Badge></div></div><div className="flex items-center gap-2 ml-4"><Button size="sm" variant="outline" onClick={() => viewPdfMutation.mutate(newsletter._id)} disabled={viewPdfMutation.isPending && viewPdfMutation.variables === newsletter._id}>{viewPdfMutation.isPending && viewPdfMutation.variables === newsletter._id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <FileText className="w-4 h-4 mr-2" />}View PDF</Button><Button size="sm" variant="outline" onClick={() => downloadPdfMutation.mutate({ newsletterId: newsletter._id, title: newsletter.title })} disabled={downloadPdfMutation.isPending && downloadPdfMutation.variables?.newsletterId === newsletter._id}>{downloadPdfMutation.isPending && downloadPdfMutation.variables?.newsletterId === newsletter._id ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Download className="w-4 h-4 mr-2" />}Download PDF</Button><Button size="icon" variant="secondary" className="h-9 w-9" onClick={() => handleOpenShareDialog(newsletter)}><Share2 className="h-4 h-4" /></Button><Button size="icon" variant="destructive" className="h-9 w-9" onClick={() => deleteNewsletterMutation.mutate(newsletter._id)} disabled={deleteNewsletterMutation.isPending && deleteNewsletterMutation.variables === newsletter._id}>{deleteNewsletterMutation.isPending && deleteNewsletterMutation.variables === newsletter._id ? <Loader2 className="h-4 h-4 animate-spin" /> : <Trash2 className="h-4 h-4" />}</Button>{newsletter.status === 'pending' && (<><Button size="sm" variant="destructive" onClick={() => updateStatusMutation.mutate({ id: newsletter._id, status: 'declined' })} disabled={updateStatusMutation.isPending}><XCircle className="w-4 h-4 mr-1"/>Decline</Button><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatusMutation.mutate({ id: newsletter._id, status: 'approved' })} disabled={updateStatusMutation.isPending}><CheckCircle className="w-4 h-4 mr-1"/>Approve</Button></>)}</div></div>); }); };
    const renderNewsArticleList = () => { if (isLoadingNews) return Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />); if (newsError) return <Alert variant="destructive"><AlertDescription>{newsError.message}</AlertDescription></Alert>; if (!newsData || newsData.articles.length === 0) return <div className="text-center py-10"><p className="text-muted-foreground">No recent news articles found.</p></div>; return newsData.articles.map((article) => (<Card key={article.url} className="overflow-hidden"><div className="p-6 flex flex-col justify-between flex-1"><div><Badge variant="secondary" className="mb-2">{article.source.name}</Badge><CardTitle className="text-lg mb-2">{article.title}</CardTitle><CardDescription>{article.description}</CardDescription>{summarizedArticles[article.url] && (<div className='mt-4'><Label className='text-xs font-semibold text-primary'>AI Summary</Label><Textarea readOnly value={summarizedArticles[article.url]} className="mt-1 bg-primary/10" rows={5} /></div>)}</div><div className='flex items-center justify-between mt-4'><div className="flex items-center gap-2"><Button variant="outline" size="sm" asChild><a href={article.url} target="_blank" rel="noopener noreferrer">Read More <ExternalLink className="w-3 h-3 ml-2"/></a></Button><Button variant="secondary" size="sm" onClick={() => summarizeMutation.mutate(article)} disabled={summarizeMutation.isPending}>{summarizeMutation.isPending && summarizeMutation.variables?.url === article.url ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}<span className='ml-2'>Summarize</span></Button></div><div className="flex items-center space-x-2"><Checkbox id={article.url} checked={selectedRawArticles.some(sa => sa.url === article.url)} onCheckedChange={(checked) => handleSelectRawArticle(article, Boolean(checked))}/><label htmlFor={article.url} className="text-sm font-medium">Select</label></div></div></div></Card>)); };
    const renderMyCategories = () => { if (isLoadingCategoryStats) return Array.from({ length: 2 }).map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-10 w-full" /></CardContent></Card>); if (categoryStatsError) return <Alert variant="destructive" className="col-span-full"><AlertDescription>{categoryStatsError.message}</AlertDescription></Alert>; if (!categoryStats || categoryStats.length === 0) return <p className="text-muted-foreground col-span-full text-center py-8">You are not assigned to any categories.</p>; return categoryStats.map((cat) => (<Card key={cat.name} className="hover:shadow-lg transition-shadow"><CardHeader><CardTitle className="text-primary">{cat.name}</CardTitle><CardDescription>Live statistics</CardDescription></CardHeader><CardContent><div className="space-y-3"><div className="flex justify-between items-center text-sm"><span className="flex items-center text-muted-foreground"><Users className="w-4 h-4 mr-2"/>Subscribers</span><span className="font-bold text-lg">{cat.subscriberCount}</span></div><div className="flex justify-between items-center text-sm"><span className="flex items-center text-muted-foreground"><Newspaper className="w-4 h-4 mr-2"/>Newsletters</span><span className="font-bold text-lg">{cat.newsletterCount}</span></div></div></CardContent></Card>)); };
    const renderUserManagement = () => {
        if (isLoadingSubscribers || isLoadingCategoryStats) {
            return <Skeleton className="h-40 w-full" />;
        }
        if (subscribersError || categoryStatsError) {
            return <Alert variant="destructive"><AlertDescription>{subscribersError?.message || categoryStatsError?.message}</AlertDescription></Alert>;
        }
        if (!categoryStats || categoryStats.length === 0) {
            return <p className="text-center text-muted-foreground py-8">You are not assigned to any categories.</p>;
        }
        return (
            <Accordion type="single" collapsible className="w-full">
                {categoryStats.map((cat) => {
                    const usersInCategory = subscribers?.filter(s => s.categories.includes(cat.name)) || [];
                    return (
                        <AccordionItem value={cat.name} key={cat.name}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-4">
                                    <span className="font-semibold">{cat.name}</span>
                                    <Badge variant="secondary">{usersInCategory.length} Subscribers</Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                {usersInCategory.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {usersInCategory.map((user) => (
                                                <TableRow key={user._id}>
                                                    <TableCell className="font-medium">{user.name}</TableCell>
                                                    <TableCell>{user.email}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className='text-destructive hover:text-destructive' 
                                                            onClick={() => removeUserFromCategoryMutation.mutate({ userId: user._id, categoryName: cat.name })}
                                                            disabled={removeUserFromCategoryMutation.isPending && removeUserFromCategoryMutation.variables?.userId === user._id}
                                                        >
                                                            {removeUserFromCategoryMutation.isPending && removeUserFromCategoryMutation.variables?.userId === user._id ? <Loader2 className='w-4 h-4 animate-spin' /> : <Trash2 className='w-4 h-4' />}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-center text-sm text-muted-foreground p-4">No users subscribed to this category yet.</p>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                    );
                })}
            </Accordion>
        );
    };
    const renderNewsletterCreator = () => { if (isLoadingSaved) return Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />); if (savedArticlesError) return <Alert variant="destructive"><AlertDescription>{savedArticlesError.message}</AlertDescription></Alert>; if (!savedArticles || savedArticles.length === 0) return <div className="text-center py-10"><p className="text-muted-foreground">You have no saved articles yet.</p></div>; return savedArticles.map((article) => (<div key={article._id} className="flex items-center space-x-4 p-2 border-b"><Checkbox id={article._id} checked={selectedCuratedArticles.some(a => a._id === article._id)} onCheckedChange={(checked) => handleSelectCuratedArticle(article, Boolean(checked))} /><div className="flex-1"><Label htmlFor={article._id} className="font-medium">{article.title}</Label><p className="text-xs text-muted-foreground">{article.sourceName}</p></div><Badge variant="outline">{article.category}</Badge><Button size="icon" variant="destructive" className="h-8 w-8 shrink-0" onClick={() => deleteArticleMutation.mutate(article._id)} disabled={deleteArticleMutation.isPending && deleteArticleMutation.variables === article._id}>{deleteArticleMutation.isPending && deleteArticleMutation.variables === article._id ? <Loader2 className="h-4 h-4 animate-spin" /> : <Trash2 className="h-4 h-4" />}</Button></div>)); };

    return (
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Tabs value={activeTab || ''} onValueChange={handleTabChange} className="w-full">
                <div className="flex justify-center"><TabsList><TabsTrigger value="create-newsletter">Create Newsletter</TabsTrigger><TabsTrigger value="generated-newsletters">Newsletters History</TabsTrigger><TabsTrigger value="categories">My Categories</TabsTrigger><TabsTrigger value="users">Users</TabsTrigger></TabsList></div>
                
                {!activeTab ? (
                    <Card className="mt-6 text-center">
                        <CardHeader>
                            <CardTitle className="text-3xl">Welcome, {user?.name}!</CardTitle>
                            <CardDescription>
                                {currentDateTime.toLocaleDateString(undefined, {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-5xl font-semibold text-primary">
                                {currentDateTime.toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit'
                                })}
                            </p>
                            <p className="text-muted-foreground mt-2">
                                Select a tab above to get started.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <TabsContent value="create-newsletter" className="mt-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle>Create a Newsletter</CardTitle>
                                            <CardDescription>Select articles below, then click 'Generate PDF' to give your newsletter a title and create it.</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Select value={articleFilter} onValueChange={setArticleFilter}>
                                                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by date" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Time</SelectItem>
                                                    <SelectItem value="day">Past 24 hours</SelectItem>
                                                    <SelectItem value="week">Past Week</SelectItem>
                                                    <SelectItem value="month">Past Month</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button variant="outline" onClick={() => setIsCurationDialogOpen(true)}><Newspaper className='w-4 h-4 mr-2'/>Curate News & Articles</Button>
                                            <Button onClick={() => setIsPdfTitleDialogOpen(true)} disabled={selectedCuratedArticles.length === 0}><FileSignature className='w-4 h-4 mr-2'/>Generate PDF</Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2">{renderNewsletterCreator()}</CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="generated-newsletters" className="mt-6"><Card><CardHeader><div className='flex items-center justify-between'><div><CardTitle>Generated Newsletters</CardTitle><CardDescription>View, approve, or decline previously generated newsletters.</CardDescription></div><Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal",!filterDate && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{filterDate ? format(filterDate, "PPP") : <span>Filter by date</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="single" selected={filterDate} onSelect={setFilterDate} /></PopoverContent></Popover></div></CardHeader><CardContent className="space-y-4">{renderNewsletterList()}</CardContent></Card></TabsContent>
                        <TabsContent value="categories" className="mt-6"><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{renderMyCategories()}</div></TabsContent>
                        <TabsContent value="users" className="mt-6"><Card><CardHeader><div className='flex items-center justify-between'><div><CardTitle className="flex items-center gap-2"><Users className='w-5 h-5' /> Subscribed Users</CardTitle><CardDescription>Users subscribed to your assigned categories.</CardDescription></div>
                        <DropdownMenu><DropdownMenuTrigger asChild><Button><Plus className='w-4 h-4 mr-2' />Add User</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setIsAddUserDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4" />Create New User</DropdownMenuItem><DropdownMenuItem onSelect={handleOpenAddExistingDialog}><ChevronsUpDown className="mr-2 h-4 w-4" />Add Existing Users</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                        </div></CardHeader><CardContent>{renderUserManagement()}</CardContent></Card></TabsContent>
                    </>
                )}
            </Tabs>
        </div>
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Share Newsletter: {sharingNewsletter?.title}</DialogTitle><DialogDescription>Select recipient groups or search all users.</DialogDescription></DialogHeader><Tabs defaultValue="my-subscribers" className="w-full pt-4"><TabsList className='grid w-full grid-cols-2'><TabsTrigger value="my-subscribers">Subscribers</TabsTrigger><TabsTrigger value="all-users">All Users</TabsTrigger></TabsList><TabsContent value="my-subscribers" className='mt-4'><ScrollArea className="h-72 w-full p-1"><div className="space-y-2 pr-4">{isLoadingAllCategories || isLoadingAllUsers ? (<Skeleton className="h-20 w-full" />) : allCategoriesError ? (<Alert variant="destructive"><AlertDescription>{allCategoriesError.message}</AlertDescription></Alert>) : !allSystemCategories || allSystemCategories.length === 0 ? (<p className="text-center text-sm text-muted-foreground py-4">No categories found in the system.</p>) : (allSystemCategories.map((cat) => { const categoryId = `cat-group-${cat.name.replace(/\s+/g, '-').toLowerCase()}`; const users = groupedUsersByCategory[cat.name] || []; const isSelected = users.length > 0 && users.every(u => selectedUserIds.includes(u._id)); return (<div key={cat._id} className="flex items-center space-x-2"><Checkbox id={categoryId} checked={isSelected} disabled={users.length === 0} onCheckedChange={(checked) => handleCategorySelection(users, Boolean(checked))}/><Label htmlFor={categoryId} className={cn("font-medium", users.length === 0 && "text-muted-foreground")}>{cat.name} ({users.length} users)</Label></div>); }))}</div></ScrollArea></TabsContent><TabsContent value="all-users" className='mt-4'><Input placeholder="Search all users..." value={shareSearchTerm} onChange={(e) => setShareSearchTerm(e.target.value)} className='mb-4'/><div className="flex items-center space-x-2 border-y py-2 px-1"><Checkbox id="select-all" checked={filteredAllUsers.length > 0 && filteredAllUsers.every(u => selectedUserIds.includes(u._id))} onCheckedChange={(checked) => handleSelectAllFiltered(Boolean(checked))}/><Label htmlFor="select-all">Select All ({filteredAllUsers.length})</Label></div><ScrollArea className="h-60 w-full pt-2">{isLoadingAllUsers ? <Skeleton className="h-20 w-full" /> : filteredAllUsers.length === 0 ? <p className="text-center text-sm text-muted-foreground py-4">No users found.</p> : filteredAllUsers.map(user => (<div key={user._id} className="flex items-center space-x-2 p-1"><Checkbox id={`all-user-${user._id}`} checked={selectedUserIds.includes(user._id)} onCheckedChange={(checked) => handleCategorySelection([user], Boolean(checked))}/><Label htmlFor={`all-user-${user._id}`} className="w-full">{user.name} <span className="text-muted-foreground">({user.email})</span></Label></div>))}</ScrollArea></TabsContent></Tabs><DialogFooter className='pt-4'><Button type="button" variant="secondary" onClick={() => setIsShareDialogOpen(false)}>Cancel</Button><Button type="submit" onClick={handleShareSubmit} disabled={selectedUserIds.length === 0 || shareNewsletterMutation.isPending}>{shareNewsletterMutation.isPending ? 'Sending...' : `Send to ${selectedUserIds.length} User(s)`}</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={isCurationDialogOpen} onOpenChange={setIsCurationDialogOpen}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>News Curation</DialogTitle><DialogDescription>Review, summarize, and select news to save for later.</DialogDescription></DialogHeader><div className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">{renderNewsArticleList()}</div><DialogFooter className="sm:justify-between items-center"><p className="text-sm text-muted-foreground">Selected Articles: <span className="font-bold">{selectedRawArticles.length}</span></p><div className="flex items-center gap-2"><Button type="button" variant="secondary" onClick={() => setIsCurationDialogOpen(false)}>Close</Button><Button onClick={handleSave} disabled={selectedRawArticles.length === 0 || saveMutation.isPending}><Save className='w-4 h-4 mr-2'/>{saveMutation.isPending ? "Saving..." : `Save Selected`}</Button></div></DialogFooter></DialogContent></Dialog>
        <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add a New User</DialogTitle><DialogDescription>A default password will be generated.</DialogDescription></DialogHeader><form onSubmit={addUserForm.handleSubmit((data) => addUserMutation.mutate(data))} className="space-y-4 pt-4"><div><Label htmlFor="name">Full Name</Label><Input id="name" {...addUserForm.register("name")} />{addUserForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.name.message}</p>}</div><div><Label htmlFor="email">Email Address</Label><Input id="email" type="email" {...addUserForm.register("email")} />{addUserForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.email.message}</p>}</div><div><Label>Assign to Categories</Label><div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto"><Controller name="categories" control={addUserForm.control} render={({ field }) => (<>{isLoadingCategoryStats ? <Skeleton className='h-5 w-20'/> : categoryStats?.map((cat) => (<div key={cat.name} className="flex items-center space-x-2"><Checkbox id={`cat-${cat.name}`} checked={field.value?.includes(cat.name)} onCheckedChange={(checked) => { const current = field.value || []; const newCategories = checked ? [...current, cat.name] : current.filter(name => name !== cat.name); field.onChange(newCategories);}}/><label htmlFor={`cat-${cat.name}`} className="text-sm font-medium">{cat.name}</label></div>))}</>)}/></div></div><DialogFooter><Button type="button" variant="secondary" onClick={() => setIsAddUserDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={addUserMutation.isPending}>{addUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : "Create User"}</Button></DialogFooter></form></DialogContent></Dialog>
        <Dialog open={!!createdUserInfo} onOpenChange={() => setCreatedUserInfo(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className='flex items-center gap-2'><UserPlus className='w-5 h-5 text-green-600'/>User Created</DialogTitle><DialogDescription>Please share these credentials with the user, or send them via email.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><p><strong>Name:</strong> {createdUserInfo?.name}</p><p><strong>Email:</strong> {createdUserInfo?.email}</p><div className='flex items-center gap-2'><p><strong>Password:</strong> <span className="font-mono bg-gray-100 p-1 rounded">{createdUserInfo?.password_was}</span></p><Button variant='outline' size='icon' className='h-7 w-7' onClick={() => {navigator.clipboard.writeText(createdUserInfo?.password_was || ''); toast.success("Password copied!");}}><Copy className='w-4 h-4'/></Button></div></div><DialogFooter className="justify-between"><Button variant="secondary" onClick={() => { if(createdUserInfo) shareUserDetailsMutation.mutate(createdUserInfo)}} disabled={shareUserDetailsMutation.isPending}>{shareUserDetailsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}Share Details via Email</Button><Button onClick={() => setCreatedUserInfo(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
        {/* --- DIALOG FOR ADDING EXISTING USERS --- */}
        <Dialog open={isAddExistingUserDialogOpen} onOpenChange={setIsAddExistingUserDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Existing Users</DialogTitle>
                    <DialogDescription>
                        Select a category and then choose users to add.
                    </DialogDescription>
                </DialogHeader>
                <div className="pt-4 space-y-4">
                    <div>
                        <Label htmlFor="category-select">Category</Label>
                        <Select value={categoryToAdd} onValueChange={setCategoryToAdd}>
                            <SelectTrigger id="category-select">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categoryStats?.map(cat => (
                                    <SelectItem key={cat.name} value={cat.name}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <ScrollArea className="h-72 w-full rounded-md border p-2">
                        {isLoadingAllUsers ? (
                            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                        ) : assignableUsers.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-10">All existing users are already subscribed to your categories.</p>
                        ) : (
                            <div className="space-y-1">
                                {assignableUsers.map(user => (
                                    <div key={user._id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-accent">
                                        <Checkbox 
                                            id={`add-user-${user._id}`}
                                            checked={usersToAdd.includes(user._id)}
                                            onCheckedChange={(checked) => {
                                                setUsersToAdd(prev => 
                                                    checked ? [...prev, user._id] : prev.filter(id => id !== user._id)
                                                );
                                            }}
                                        />
                                        <Label htmlFor={`add-user-${user._id}`} className="w-full font-normal">
                                            {user.name} <span className="text-muted-foreground text-xs">({user.email})</span>
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsAddExistingUserDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" onClick={handleAddExistingUsersSubmit} disabled={usersToAdd.length === 0 || !categoryToAdd || addUsersToCategoryMutation.isPending}>
                        {addUsersToCategoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Add {usersToAdd.length > 0 ? usersToAdd.length : ''} User(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        {/* --- DIALOG FOR PDF TITLE --- */}
        <Dialog open={isPdfTitleDialogOpen} onOpenChange={setIsPdfTitleDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Newsletter Title</DialogTitle>
                    <DialogDescription>
                        Please enter a title for your new newsletter before generating.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <Label htmlFor="newsletter-title-input" className="text-left">
                        Title
                    </Label>
                    <Input
                        id="newsletter-title-input"
                        value={newsletterTitle}
                        onChange={(e) => setNewsletterTitle(e.target.value)}
                        placeholder="e.g., Weekly Tech Roundup"
                        className="col-span-3"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPdfTitleDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleGeneratePdf} disabled={!newsletterTitle || generatePdfMutation.isPending}>
                        {generatePdfMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                        Generate PDF
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    );
};
export default Dashboard;