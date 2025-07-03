import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, AlertCircle, User as UserIcon, LayoutGrid, Users, Loader2, Copy, UserPlus, Mail, Share2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AdminHeader } from '@/components/AdminHeader';
import { fetchWithToken } from '@/lib/api';
import { toast } from 'sonner';

// --- Data Types ---
interface Admin { _id: string; name: string; email: string; userType: 'admin' | 'superadmin'; status: 'Active' | 'Inactive'; categories: string[]; }
interface Category { _id: string; name: string; admins: string[]; }
interface RegularUser { _id: string; name: string; email: string; status: 'Active' | 'Inactive'; categories: string[]; createdAt: string; }

// --- Zod Schemas ---
const adminSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").optional().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']).optional(),
  categories: z.array(z.string()).optional(),
});
type AdminFormData = z.infer<typeof adminSchema>;

const categorySchema = z.object({ name: z.string().min(2, "Category name is required.") });
type CategoryFormData = z.infer<typeof categorySchema>;

const addUserSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  categories: z.array(z.string()).default([]),
});
type AddUserFormData = z.infer<typeof addUserSchema>;

const editUserSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address."),
  categories: z.array(z.string()).default([]),
});
type EditUserFormData = z.infer<typeof editUserSchema>;


const SuperAdmin = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  
  const [isAdminFormOpen, setIsAdminFormOpen] = useState(false);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [categoryView, setCategoryView] = useState<'byAdmin' | 'byCategory'>('byAdmin');
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [createdUserInfo, setCreatedUserInfo] = useState<{ name: string; email: string; password_was: string } | null>(null);
  const [editingUser, setEditingUser] = useState<RegularUser | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(searchParams.get('tab'));
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const adminForm = useForm<AdminFormData>({ resolver: zodResolver(adminSchema), defaultValues: { categories: [] } });
  const categoryForm = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema) });
  const addUserForm = useForm<AddUserFormData>({ resolver: zodResolver(addUserSchema), defaultValues: { name: '', email: '', categories: [] } });
  const editUserForm = useForm<EditUserFormData>({ resolver: zodResolver(editUserSchema) });

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

  useEffect(() => {
    if (isAdminFormOpen) {
      adminForm.reset(editingAdmin ? { ...editingAdmin, password: '' } : { name: '', email: '', password: '', status: 'Active', categories: [] });
    }
  }, [isAdminFormOpen, editingAdmin, adminForm]);

  useEffect(() => {
    if (editingUser) {
      editUserForm.reset({ 
        name: editingUser.name,
        email: editingUser.email,
        categories: editingUser.categories 
      });
    }
  }, [editingUser, editUserForm]);

  const { data: admins, isLoading: isLoadingAdmins, error: adminsError } = useQuery<Admin[], Error>({ queryKey: ['admins'], queryFn: () => fetchWithToken('/admins', token), enabled: !!token });
  const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useQuery<Category[], Error>({ queryKey: ['categories'], queryFn: () => fetchWithToken('/categories', token), enabled: !!token });
  const { data: allRegularUsers, isLoading: isLoadingAllUsers, error: allUsersError } = useQuery<RegularUser[], Error>({ queryKey: ['allRegularUsers'], queryFn: () => fetchWithToken('/admins/all-regular-users', token), enabled: !!token });

  const upsertAdminMutation = useMutation<Admin, Error, AdminFormData>({ mutationFn: (data: AdminFormData) => { const { _id, ...adminData } = data; const url = _id ? `/admins/${_id}` : '/admins'; const method = _id ? 'PATCH' : 'POST'; if (_id && (!adminData.password || adminData.password.trim() === '')) { delete adminData.password; } return fetchWithToken(url, token, { method, body: JSON.stringify(adminData) }); }, onSuccess: () => { toast.success(`Admin ${editingAdmin ? 'updated' : 'added'} successfully!`); queryClient.invalidateQueries({ queryKey: ['admins'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); setIsAdminFormOpen(false); }, onError: (err: Error) => toast.error(err.message), });
  const removeAdminMutation = useMutation<{ message: string }, Error, string>({ mutationFn: (adminId: string) => fetchWithToken(`/admins/${adminId}`, token, { method: 'DELETE' }), onSuccess: () => { toast.success("Admin removed successfully!"); queryClient.invalidateQueries({ queryKey: ['admins'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); }, onError: (err: Error) => toast.error(err.message) });
  const addCategoryMutation = useMutation<Category, Error, CategoryFormData>({ mutationFn: (data: CategoryFormData) => fetchWithToken('/categories', token, { method: 'POST', body: JSON.stringify(data) }), onSuccess: () => { toast.success("Category added successfully!"); queryClient.invalidateQueries({ queryKey: ['categories'] }); setIsCategoryFormOpen(false); categoryForm.reset(); }, onError: (err: Error) => toast.error(err.message) });
  const removeCategoryMutation = useMutation<{ message: string }, Error, string>({ mutationFn: (categoryId: string) => fetchWithToken(`/categories/${categoryId}`, token, { method: 'DELETE' }), onSuccess: () => { toast.success("Category removed successfully!"); queryClient.invalidateQueries({ queryKey: ['categories'] }); queryClient.invalidateQueries({ queryKey: ['admins'] }); }, onError: (err: Error) => toast.error(err.message), });
  const deleteUserMutation = useMutation<{ message: string }, Error, string>({ mutationFn: (userId: string) => fetchWithToken(`/admins/user/${userId}`, token, { method: 'DELETE' }), onSuccess: () => { toast.success("User deleted successfully!"); queryClient.invalidateQueries({ queryKey: ['allRegularUsers'] }); }, onError: (err: Error) => { toast.error(err.message || "Failed to delete user."); } });
  const addUserMutation = useMutation<{ message: string; user: { _id: string; name: string; email: string; }; password_was: string }, Error, AddUserFormData>({ mutationFn: (data: AddUserFormData) => fetchWithToken('/admins/super-add-user', token, { method: 'POST', body: JSON.stringify(data) }), onSuccess: (data) => { toast.success(data.message); queryClient.invalidateQueries({ queryKey: ['allRegularUsers'] }); setIsAddUserDialogOpen(false); setCreatedUserInfo({ ...data.user, password_was: data.password }); addUserForm.reset(); }, onError: (err: Error) => toast.error(err.message), });
  const updateUserMutation = useMutation<RegularUser, Error, { userId: string } & EditUserFormData>({
    mutationFn: (data) => {
        const { userId, ...payload } = data;
        return fetchWithToken(`/admins/user/${userId}/details`, token, { 
            method: 'PATCH', 
            body: JSON.stringify(payload) 
        });
    },
    onSuccess: () => {
        toast.success("User details updated successfully!");
        queryClient.invalidateQueries({ queryKey: ['allRegularUsers'] });
        setEditingUser(null);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update user.")
  });
  const shareUserDetailsMutation = useMutation<{ message: string }, Error, { email: string; name: string; password_was: string }>({
    mutationFn: (data) => fetchWithToken('/admins/share-new-user-details', token, { method: 'POST', body: JSON.stringify({ email: data.email, name: data.name, password: data.password_was }) }),
    onSuccess: (data) => { toast.success(data.message); },
    onError: (err: Error) => { toast.error(err.message || "Failed to share details."); }
  });
  const resetPasswordMutation = useMutation<{ message: string }, Error, string>({
    mutationFn: (userId: string) => fetchWithToken(`/admins/user/${userId}/reset-password`, token, { method: 'POST' }),
    onSuccess: (data) => { toast.success(data.message); },
    onError: (err: Error) => { toast.error(err.message || "Failed to reset password."); }
  });

  const onEditUserSubmit = (data: EditUserFormData) => {
    if (!editingUser) {
      toast.error("Error: No user selected for editing.");
      return;
    }
    updateUserMutation.mutate({
      userId: editingUser._id,
      ...data
    });
  };

  const handleOpenAdminDialog = (admin: Admin | null = null) => { setEditingAdmin(admin); setIsAdminFormOpen(true); };

  const filteredUsers = useMemo(() => {
    if (!allRegularUsers) return [];
    let users = allRegularUsers;
    if (categoryFilter !== 'all') {
        users = users.filter(user => user.categories.includes(categoryFilter));
    }
    if (searchTerm) {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        users = users.filter(user =>
            user.name.toLowerCase().includes(lowercasedSearchTerm) ||
            user.email.toLowerCase().includes(lowercasedSearchTerm)
        );
    }
    return users;
  }, [allRegularUsers, categoryFilter, searchTerm]);

  const renderAdminList = () => {
    if (isLoadingAdmins) return Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />);
    if (adminsError) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{adminsError.message}</AlertDescription></Alert>;
    if (!admins) return <p>No admins found.</p>;
    return admins.map((admin) => (
      <div key={admin._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
        <div><h3 className="font-semibold">{admin.name} <span className="text-sm font-normal text-muted-foreground">({admin.email})</span></h3><div className="flex items-center gap-2 mt-1"><Badge variant={admin.status === 'Active' ? 'default' : 'secondary'}>{admin.status}</Badge><Badge variant="outline">{admin.userType}</Badge></div></div>
        <div className="flex items-center gap-2 ml-4"><Button variant="outline" size="sm" onClick={() => handleOpenAdminDialog(admin)}><Edit className="w-4 h-4 mr-1" />Edit</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm" className="text-red-600" disabled={removeAdminMutation.isPending || admin.userType === 'superadmin'}><Trash2 className="w-4 h-4 mr-1" />Remove</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently remove <span className="font-semibold">{admin.name}</span> as an admin. They will lose all admin privileges.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => removeAdminMutation.mutate(admin._id)} disabled={removeAdminMutation.isPending}>{removeAdminMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Confirm"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
      </div>
    ));
  };
  
  const renderAssignmentsByAdmin = () => {
    if (isLoadingAdmins) return Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />);
    if (adminsError) return <Alert variant="destructive" className="col-span-full"><AlertDescription>{adminsError.message}</AlertDescription></Alert>;
    const categoryAdmins = admins?.filter(a => a.userType === 'admin');
    if (!categoryAdmins || categoryAdmins.length === 0) return <p className="text-muted-foreground col-span-full text-center py-8">No admins have been created yet.</p>;
    return categoryAdmins.map((admin) => (
        <Card key={admin._id}><CardHeader><CardTitle>{admin.name}</CardTitle><CardDescription>{admin.email}</CardDescription></CardHeader><CardContent><h4 className="text-sm font-semibold mb-2">Managed Categories:</h4><div className="flex flex-wrap gap-2">{admin.categories.length > 0 ? admin.categories.map(catName => <Badge key={catName} variant="secondary">{catName}</Badge>) : <p className="text-sm text-muted-foreground">No categories assigned.</p>}</div></CardContent></Card>
    ));
  };

  const renderAssignmentsByCategory = () => {
    if (isLoadingCategories || isLoadingAdmins) {
      return Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />);
    }
    if (categoriesError) {
      return <Alert variant="destructive" className="col-span-full"><AlertDescription>{`Failed to load categories: ${categoriesError.message}`}</AlertDescription></Alert>;
    }
     if (adminsError) {
      return <Alert variant="destructive" className="col-span-full"><AlertDescription>{`Failed to load admins: ${adminsError.message}`}</AlertDescription></Alert>;
    }
    if (!categories || categories.length === 0) {
      return <p className="text-muted-foreground col-span-full text-center py-8">No categories have been created yet.</p>;
    }

    return categories.map((category) => {
        const assignedAdmins = admins?.filter(admin => category.admins.includes(admin._id)) || [];
        return (
            <Card key={category._id} className="transition-shadow hover:shadow-md flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between">
                    <CardTitle>{category.name}</CardTitle>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0 hover:bg-red-50 hover:text-red-600" disabled={removeCategoryMutation.isPending}>
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the <span className="font-semibold">{category.name}</span> category. All admin assignments for this category will be removed. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeCategoryMutation.mutate(category._id)} disabled={removeCategoryMutation.isPending}>
                                    {removeCategoryMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Delete Category"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardHeader>
                <CardContent className="flex-grow pt-0">
                  <Label className="text-xs text-muted-foreground">Managed By</Label>
                  <div className="mt-2 flex flex-col gap-1 items-start">
                    {assignedAdmins.length > 0 ? (
                      assignedAdmins.map(admin => (<Badge key={admin._id} variant="outline">{admin.name}</Badge>))
                    ) : (
                      <p className="text-sm text-muted-foreground">No admin assigned</p>
                    )}
                  </div>
                </CardContent>
            </Card>
        );
    });
  };

  const renderAllUsersList = () => {
    if (isLoadingAllUsers) { return Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)); }
    if (allUsersError) { return <TableRow><TableCell colSpan={6}><Alert variant="destructive"><AlertDescription>{allUsersError.message}</AlertDescription></Alert></TableCell></TableRow>; }
    if (!filteredUsers || filteredUsers.length === 0) { return <TableRow><TableCell colSpan={6} className="text-center h-24">No users match the current filters.</TableCell></TableRow>; }
    
    return filteredUsers.map((user) => (
      <TableRow key={user._id}>
        <TableCell className="font-medium">{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell><Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>{user.status}</Badge></TableCell>
        <TableCell><div className="flex flex-wrap gap-1">{user.categories.length > 0 ? user.categories.map(cat => <Badge key={cat} variant="outline">{cat}</Badge>) : <span className="text-xs text-muted-foreground">None</span>}</div></TableCell>
        <TableCell>{format(new Date(user.createdAt), 'PP')}</TableCell>
        <TableCell className="text-right flex items-center justify-end gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingUser(user)}><Edit className="h-4 w-4" /></Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8"><Share2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset and Share Password?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will generate a new temporary password for <span className="font-semibold">{user.name}</span> and email it to them. The user's current password will no longer work. Are you sure you want to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => resetPasswordMutation.mutate(user._id)} disabled={resetPasswordMutation.isPending && resetPasswordMutation.variables === user._id}>
                            {resetPasswordMutation.isPending && resetPasswordMutation.variables === user._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yes, Reset and Share"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the user <span className="font-semibold">{user.name}</span> and all of their data. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteUserMutation.mutate(user._id)} disabled={deleteUserMutation.isPending}>{deleteUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete User"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </TableCell>
      </TableRow>
    ));
  };


  return (
    <>
      <div className="min-h-screen bg-background">
        <AdminHeader />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Tabs value={activeTab || ''} onValueChange={handleTabChange} className="w-full">
                <div className='flex justify-center'><TabsList><TabsTrigger value="admins">Admin Management</TabsTrigger><TabsTrigger value="categories">Category Assignment</TabsTrigger><TabsTrigger value="all-users">All Users</TabsTrigger></TabsList></div>
                
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
                        <TabsContent value="admins" className="space-y-6 mt-6">
                            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Admin Management</h2><Button onClick={() => handleOpenAdminDialog()}><Plus className="w-4 h-4 mr-2" />Add New Admin</Button></div>
                            <Card><CardContent className="p-6 space-y-4">{renderAdminList()}</CardContent></Card>
                        </TabsContent>
                        
                        <TabsContent value="categories" className="space-y-6 mt-6">
                            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Category Assignment</h2><div className='flex items-center gap-4'><ToggleGroup type="single" value={categoryView} onValueChange={(v) => {if (v) setCategoryView(v as any)}} defaultValue="byAdmin"><ToggleGroupItem value="byAdmin" aria-label="View by admin"><UserIcon className="h-4 w-4 mr-2"/>View by Admin</ToggleGroupItem><ToggleGroupItem value="byCategory" aria-label="View by category"><LayoutGrid className="h-4 w-4 mr-2"/>View by Category</ToggleGroupItem></ToggleGroup><Button onClick={() => setIsCategoryFormOpen(true)}><Plus className="w-4 h-4 mr-2" />Add New Category</Button></div></div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{categoryView === 'byAdmin' ? renderAssignmentsByAdmin() : renderAssignmentsByCategory()}</div>
                        </TabsContent>
                        
                        <TabsContent value="all-users" className="space-y-6 mt-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2"><Users /> All Users</CardTitle>
                                        <CardDescription>A complete list of all regular (non-admin) users in the system.</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            placeholder="Search by name or email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-64"
                                        />
                                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Filter by category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Categories</SelectItem>
                                                {categories?.map((category) => (
                                                    <SelectItem key={category._id} value={category.name}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={() => setIsAddUserDialogOpen(true)}><UserPlus className="mr-2 h-4 w-4"/>Add User</Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Subscriptions</TableHead><TableHead>Joined On</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{renderAllUsersList()}</TableBody></Table></CardContent>
                        </Card>
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
      </div>
      
      <Dialog open={isAdminFormOpen} onOpenChange={setIsAdminFormOpen}>
        <DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{editingAdmin ? 'Edit Administrator' : 'Add New Administrator'}</DialogTitle></DialogHeader>
            <form onSubmit={adminForm.handleSubmit(data => upsertAdminMutation.mutate(data))} className="space-y-4 pt-4">
                <Input type="hidden" {...adminForm.register("_id")} />
                <div><Label htmlFor="name">Full Name</Label><Input id="name" {...adminForm.register("name")} />{adminForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{adminForm.formState.errors.name.message}</p>}</div>
                <div><Label htmlFor="email">Email Address</Label><Input id="email" type="email" {...adminForm.register("email")} />{adminForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{adminForm.formState.errors.email.message}</p>}</div>
                {!editingAdmin && (<div><Label htmlFor="password">Password</Label><Input id="password" type="password" placeholder='Set initial password' {...adminForm.register("password")} />{adminForm.formState.errors.password && <p className="text-sm text-destructive mt-1">{adminForm.formState.errors.password.message}</p>}</div>)}
                {editingAdmin && (<div><Label>Status</Label><Controller name="status" control={adminForm.control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select>)} /></div>)}
                <div><Label>Assign Categories</Label><div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto"><Controller name="categories" control={adminForm.control} render={({ field }) => (<>{isLoadingCategories ? <Skeleton className='h-5 w-20'/> : categories?.map((category) => (<div key={category._id} className="flex items-center space-x-2"><Checkbox id={category._id} checked={field.value?.includes(category.name)} onCheckedChange={(checked) => { const current = field.value || []; const newCategories = checked ? [...current, category.name] : current.filter(name => name !== category.name); field.onChange(newCategories);}}/><label htmlFor={category._id} className="text-sm font-medium">{category.name}</label></div>))}</>)}/></div></div>
                <DialogFooter><Button type="button" variant="secondary" onClick={() => setIsAdminFormOpen(false)}>Cancel</Button><Button type="submit" disabled={upsertAdminMutation.isPending}>{upsertAdminMutation.isPending ? "Saving..." : "Save Changes"}</Button></DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
            <form onSubmit={categoryForm.handleSubmit(data => addCategoryMutation.mutate(data))} className="space-y-4 pt-4">
                <div><Label htmlFor="category-name">Category Name</Label><Input id="category-name" {...categoryForm.register("name")} />{categoryForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{categoryForm.formState.errors.name.message}</p>}</div>
                <DialogFooter><Button type="button" variant="secondary" onClick={() => setIsCategoryFormOpen(false)}>Cancel</Button><Button type="submit" disabled={addCategoryMutation.isPending}>{addCategoryMutation.isPending ? "Adding..." : "Add Category"}</Button></DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create a New User</DialogTitle><DialogDescription>An initial password will be auto-generated and displayed upon creation.</DialogDescription></DialogHeader>
          <form onSubmit={addUserForm.handleSubmit(data => addUserMutation.mutate(data))} className="space-y-4 pt-4">
              <div><Label htmlFor="add-user-name">Full Name</Label><Input id="add-user-name" {...addUserForm.register("name")} />{addUserForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.name.message}</p>}</div>
              <div><Label htmlFor="add-user-email">Email Address</Label><Input id="add-user-email" type="email" {...addUserForm.register("email")} />{addUserForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{addUserForm.formState.errors.email.message}</p>}</div>
              <div><Label>Assign Categories</Label><div className="space-y-2 rounded-md border p-4 max-h-40 overflow-y-auto"><Controller name="categories" control={addUserForm.control} render={({ field }) => (<>{isLoadingCategories ? <Skeleton className='h-5 w-20'/> : categories?.map((category) => (<div key={category._id} className="flex items-center space-x-2"><Checkbox id={`add-user-cat-${category._id}`} checked={field.value?.includes(category.name)} onCheckedChange={(checked) => { const current = field.value || []; const newCategories = checked ? [...current, category.name] : current.filter(name => name !== category.name); field.onChange(newCategories);}}/><label htmlFor={`add-user-cat-${category._id}`} className="text-sm font-medium">{category.name}</label></div>))}</>)}/></div></div>
              <DialogFooter><Button type="button" variant="secondary" onClick={() => setIsAddUserDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={addUserMutation.isPending}>{addUserMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</> : "Create User"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!createdUserInfo} onOpenChange={() => setCreatedUserInfo(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className='flex items-center gap-2'><UserPlus className='w-5 h-5 text-green-600'/>User Created Successfully</DialogTitle><DialogDescription>Please share these temporary credentials with the user, or send them via email.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <p><strong>Name:</strong> {createdUserInfo?.name}</p>
            <p><strong>Email:</strong> {createdUserInfo?.email}</p>
            <div className='flex items-center gap-2'>
              <p><strong>Password:</strong> <span className="font-mono bg-gray-100 p-1 rounded">{createdUserInfo?.password_was}</span></p>
              <Button variant='outline' size='icon' className='h-7 w-7' onClick={() => {navigator.clipboard.writeText(createdUserInfo?.password_was || ''); toast.success("Password copied!");}}><Copy className='w-4 h-4'/></Button>
            </div>
          </div>
          <DialogFooter className="justify-between">
            <Button variant="secondary" onClick={() => { if(createdUserInfo) shareUserDetailsMutation.mutate(createdUserInfo)}} disabled={shareUserDetailsMutation.isPending}>
                {shareUserDetailsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Share Details via Email
            </Button>
            <Button onClick={() => setCreatedUserInfo(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
            <DialogDescription>
              Update the user's details and subscriptions for <span className="font-semibold">{editingUser?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4 pt-4">
            <div>
              <Label htmlFor="edit-user-name">Full Name</Label>
              <Input id="edit-user-name" {...editUserForm.register("name")} />
              {editUserForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{editUserForm.formState.errors.name.message}</p>}
            </div>
             <div>
              <Label htmlFor="edit-user-email">Email Address</Label>
              <Input id="edit-user-email" type="email" {...editUserForm.register("email")} />
              {editUserForm.formState.errors.email && <p className="text-sm text-destructive mt-1">{editUserForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Subscriptions</Label>
              <div className="rounded-md border p-4 max-h-60 overflow-y-auto">
                <Controller name="categories" control={editUserForm.control} render={({ field }) => ( <> {isLoadingCategories ? <Skeleton className='h-5 w-20'/> : categories?.map((category) => (<div key={category._id} className="flex items-center space-x-2"><Checkbox id={`edit-cat-${category._id}`} checked={field.value?.includes(category.name)} onCheckedChange={(checked) => { const current = field.value || []; const newCategories = checked ? [...current, category.name] : current.filter(name => name !== category.name); field.onChange(newCategories); }}/><label htmlFor={`edit-cat-${category._id}`} className="text-sm font-medium">{category.name}</label></div>))} </> )}/>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>{updateUserMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SuperAdmin;