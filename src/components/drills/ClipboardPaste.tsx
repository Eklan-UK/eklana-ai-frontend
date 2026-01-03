"use client";

import React, { useState } from "react";
import { Clipboard, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "sonner";
import { ParsedContent } from "@/services/document-parser.service";

interface ClipboardPasteProps {
	onParse: (parsed: ParsedContent) => void;
	onCancel?: () => void;
}

export const ClipboardPaste: React.FC<ClipboardPasteProps> = ({
	onParse,
	onCancel,
}) => {
	const [text, setText] = useState("");
	const [isParsing, setIsParsing] = useState(false);
	const [showInput, setShowInput] = useState(false);

	const handlePaste = async () => {
		if (!text.trim()) {
			toast.error("Please paste some content");
			return;
		}

		try {
			setIsParsing(true);

			const response = await fetch("/api/v1/drills/parse-clipboard", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({ text }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to parse clipboard data");
			}

			const result = await response.json();
			onParse(result.data);
			setText("");
			setShowInput(false);
			toast.success("Clipboard data parsed successfully");
		} catch (error: any) {
			toast.error("Failed to parse clipboard: " + error.message);
		} finally {
			setIsParsing(false);
		}
	};

	const handlePasteFromClipboard = async () => {
		try {
			const clipboardText = await navigator.clipboard.readText();
			setText(clipboardText);
			setShowInput(true);
		} catch (error) {
			// Fallback: show input field
			setShowInput(true);
		}
	};

	if (!showInput) {
		return (
			<Button
				variant="outline"
				size="sm"
				onClick={handlePasteFromClipboard}
				className="flex items-center gap-2"
			>
				<Clipboard className="w-4 h-4" />
				Paste from Clipboard
			</Button>
		);
	}

	return (
		<div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
			<label className="block text-sm font-medium text-gray-700 mb-2">
				Paste your data here (CSV, TSV, or tab-separated format)
			</label>
			<Textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Paste your data here... (e.g., word,translation or word|translation)"
				rows={6}
				className="mb-3"
			/>
			<div className="flex items-center gap-2">
				<Button
					onClick={handlePaste}
					disabled={isParsing || !text.trim()}
					size="sm"
					className="flex items-center gap-2"
				>
					{isParsing ? (
						<Loader2 className="w-4 h-4 animate-spin" />
					) : (
						<CheckCircle className="w-4 h-4" />
					)}
					Parse Data
				</Button>
				{onCancel && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setShowInput(false);
							setText("");
							onCancel();
						}}
					>
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
};


