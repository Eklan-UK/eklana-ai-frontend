"use client";

import React from "react";
import { CheckCircle, AlertCircle, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ParsedContent } from "@/services/document-parser.service";

interface ContentPreviewProps {
	parsedContent: ParsedContent;
	onConfirm: () => void;
	onEdit?: () => void;
	onCancel?: () => void;
}

export const ContentPreview: React.FC<ContentPreviewProps> = ({
	parsedContent,
	onConfirm,
	onEdit,
	onCancel,
}) => {
	const { type, confidence, extractedData } = parsedContent;
	const { title, items, metadata } = extractedData;

	const getConfidenceColor = (conf: number) => {
		if (conf >= 0.7) return "text-emerald-600";
		if (conf >= 0.5) return "text-yellow-600";
		return "text-orange-600";
	};

	const getConfidenceLabel = (conf: number) => {
		if (conf >= 0.7) return "High";
		if (conf >= 0.5) return "Medium";
		return "Low";
	};

	return (
		<div className="border border-border rounded-lg p-6 bg-card">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-lg font-semibold text-foreground">Parsed Content Preview</h3>
					<p className="text-sm text-muted-foreground">
						Detected type: <span className="font-medium capitalize">{type}</span> (
						<span className={getConfidenceColor(confidence)}>
							{getConfidenceLabel(confidence)} confidence: {Math.round(confidence * 100)}%
						</span>
						)
					</p>
				</div>
				{onEdit && (
					<Button
						variant="outline"
						size="sm"
						onClick={onEdit}
						className="flex items-center gap-2"
					>
						<Edit2 className="w-4 h-4" />
						Edit
					</Button>
				)}
			</div>

			{/* Title */}
			{title && (
				<div className="mb-4">
					<label className="text-xs font-medium text-muted-foreground uppercase">Title</label>
					<p className="text-sm text-foreground mt-1">{title}</p>
				</div>
			)}

			{/* Metadata */}
			{metadata && (metadata.difficulty || metadata.context) && (
				<div className="mb-4 grid grid-cols-2 gap-4">
					{metadata.difficulty && (
						<div>
							<label className="text-xs font-medium text-muted-foreground uppercase">Difficulty</label>
							<p className="text-sm text-foreground mt-1 capitalize">{metadata.difficulty}</p>
						</div>
					)}
					{metadata.context && (
						<div>
							<label className="text-xs font-medium text-muted-foreground uppercase">Context</label>
							<p className="text-sm text-foreground mt-1">{metadata.context}</p>
						</div>
					)}
				</div>
			)}

			{/* Items Preview */}
			<div className="mb-4">
				<label className="text-xs font-medium text-muted-foreground uppercase mb-2 block">
					Extracted Items ({items.length})
				</label>
				<div className="max-h-64 overflow-y-auto border border-border rounded-lg">
					<table className="w-full text-sm">
						<thead className="bg-muted sticky top-0">
							<tr>
								{type === "vocabulary" && (
									<>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Word</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Translation</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Sentence</th>
									</>
								)}
								{type === "matching" && (
									<>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Left</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Right</th>
									</>
								)}
								{type === "roleplay" && (
									<>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Scene</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Dialogue Turns</th>
									</>
								)}
								{(type === "definition" || type === "sentence_writing") && (
									<>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Word</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Hint</th>
									</>
								)}
								{type === "grammar" && (
									<>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pattern</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Example</th>
									</>
								)}
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{items.slice(0, 10).map((item, index) => (
								<tr key={index} className="hover:bg-muted">
									{type === "vocabulary" && (
										<>
											<td className="px-3 py-2">{item.word || "-"}</td>
											<td className="px-3 py-2">{item.wordTranslation || "-"}</td>
											<td className="px-3 py-2">{item.text || "-"}</td>
										</>
									)}
									{type === "matching" && (
										<>
											<td className="px-3 py-2">{item.left || "-"}</td>
											<td className="px-3 py-2">{item.right || "-"}</td>
										</>
									)}
									{type === "roleplay" && (
										<>
											<td className="px-3 py-2">{item.scene_name || "-"}</td>
											<td className="px-3 py-2">{item.dialogue?.length || 0} turns</td>
										</>
									)}
									{(type === "definition" || type === "sentence_writing") && (
										<>
											<td className="px-3 py-2">{item.word || "-"}</td>
											<td className="px-3 py-2">{item.hint || "-"}</td>
										</>
									)}
									{type === "grammar" && (
										<>
											<td className="px-3 py-2">{item.pattern || "-"}</td>
											<td className="px-3 py-2">{item.example || "-"}</td>
										</>
									)}
								</tr>
							))}
						</tbody>
					</table>
					{items.length > 10 && (
						<div className="px-3 py-2 text-xs text-muted-foreground text-center bg-muted">
							... and {items.length - 10} more items
						</div>
					)}
				</div>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-3 pt-4 border-t border-border">
				<Button
					onClick={() => onConfirm()}
					className="flex-1 flex items-center justify-center gap-2"
				>
					<CheckCircle className="w-4 h-4" />
					Use This Data
				</Button>
				{onCancel && (
					<Button
						variant="outline"
						onClick={onCancel}
						className="flex-1"
					>
						Cancel
					</Button>
				)}
			</div>
		</div>
	);
};


