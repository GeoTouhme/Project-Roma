import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, Loader2, Upload } from "lucide-react";
import { userAPI, uploadAPI } from "@/lib/api";

const MyAccount = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cover, setCover] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await userAPI.getProfile();
      if (response.data.success) {
        const user = response.data.data;
        setFirstName(user.firstName || "");
        setLastName(user.lastName || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        
        if (user.cover) {
          setCover(user.cover);
          setPreview(typeof user.cover === 'string' ? user.cover : user.cover.url);
        }
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      toast.error("Failed to load profile settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await uploadAPI.uploadImage(formData);
      if (response.data.success) {
        const uploadedImageData = response.data.data;
        setCover(uploadedImageData);
        setPreview(uploadedImageData.url);
        toast.success("Avatar uploaded successfully");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!firstName || !lastName || !email) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        cover: cover
      };

      const response = await userAPI.updateProfile(payload);
      if (response.data.success) {
        toast.success("Profile updated successfully!");
        // Update local storage if needed to reflect changes in sidebar/header
        const savedUser = localStorage.getItem("admin_user");
        if (savedUser) {
           const userObj = JSON.parse(savedUser);
           userObj.firstName = firstName;
           userObj.lastName = lastName;
           userObj.name = `${firstName} ${lastName}`;
           userObj.email = email;
           userObj.avatar = preview;
           localStorage.setItem("admin_user", JSON.stringify(userObj));
        }
      }
    } catch (error: any) {
      console.error("Save failed:", error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const payload = {
        password: oldPassword,
        newPassword,
        confirmPassword
      };

      const response = await userAPI.changePassword(payload);
      if (response.data.success) {
        toast.success("Password changed successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      console.error("Password change failed:", error);
      toast.error(error.response?.data?.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="My Account"
          description="Manage your profile and account settings."
        />
        <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Picture */}
            <div className="flex flex-col items-center sm:flex-row gap-6 pb-4">
              <div className="relative group">
                <img
                  src={preview || `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=0D8ABC&color=fff`}
                  alt="Profile"
                  className="w-24 h-24 object-cover rounded-full border-2 border-muted"
                />
                {isUploading && (
                   <div className="absolute inset-0 bg-black/20 rounded-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                   </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Profile Picture</label>
                <div className="flex items-center gap-2">
                   <Button variant="outline" size="sm" asChild disabled={isUploading}>
                      <label className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Image
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleAvatarChange}
                        />
                      </label>
                   </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                   Recommended: Square image, max 2MB.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
               <div className="space-y-2">
                  <label className="text-sm font-medium">First Name</label>
                  <Input
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
               </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Change Password Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Old Password</label>
              <Input
                type="password"
                placeholder="Enter old password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleChangePassword} 
              disabled={isChangingPassword}
            >
              {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyAccount;
