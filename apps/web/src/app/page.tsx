"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultModuleHrefForPermissions } from "@/config/modules";
import { useAuth } from "@/features/auth/AuthProvider";

export default function Home() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(getDefaultModuleHrefForPermissions(user.permissions));
    }
  }, [router, status, user]);

  return <div className="loading-panel">Carregando módulo inicial...</div>;
}