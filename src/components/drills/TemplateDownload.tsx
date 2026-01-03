"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

interface TemplateDownloadProps {
	drillType: string;
	onDownloadComplete?: () => void;
}

export const TemplateDownload: React.FC<TemplateDownloadProps> = ({
	drillType,
	onDownloadComplete,
}) => {
	const [downloading, setDownloading] = useState(false);

	const handleDownload = async () => {
		try {
			setDownloading(true);

			const response = await fetch(`/api/v1/drills/templates/${drillType}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
			});

			if (!response.ok) {
				throw new Error("Failed to download template");
			}

			// Get blob and create download link
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${drillType}-template.xlsx`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			toast.success("Template downloaded successfully");
			if (onDownloadComplete) {
				onDownloadComplete();
			}
		} catch (error: any) {
			toast.error("Failed to download template: " + error.message);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleDownload}
			disabled={downloading}
			className="flex items-center gap-2"
		>
			{downloading ? (
				<Loader2 className="w-4 h-4 animate-spin" />
			) : (
				<Download className="w-4 h-4" />
			)}
			Download Template
		</Button>
	);
};


