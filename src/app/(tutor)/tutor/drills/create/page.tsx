"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  ArrowLeft,
  Plus,
  X,
  Save,
  Users,
  Loader2,
  FileText,
  CheckCircle,
  Upload,
  Clipboard,
} from "lucide-react";
import Link from "next/link";
import { drillAPI, tutorAPI } from "@/lib/api";
import { FileUploadZone } from "@/components/drills/FileUploadZone";
import { ContentPreview } from "@/components/drills/ContentPreview";
import { TemplateDownload } from "@/components/drills/TemplateDownload";
import { ClipboardPaste } from "@/components/drills/ClipboardPaste";
import { ParsedContent } from "@/services/document-parser.service";
import { toast } from "sonner";

const DRAFT_KEY = "drill_draft";

interface DrillFormData {
  title: string;
  date: string;
  duration_days: number;
  type: string;
  difficulty: string;
  assigned_to: string[];
  context: string;
  audio_example_url?: string;
  target_sentences: Array<{
    word?: string;
    wordTranslation?: string;
    text: string;
    translation?: string;
  }>;
  student_character_name?: string;
  ai_character_names?: string[];
  roleplay_scenes?: Array<{
    scene_name: string;
    context?: string;
    dialogue: Array<{
      speaker: string;
      text: string;
      translation?: string;
    }>;
  }>;
  roleplay_dialogue?: Array<{
    speaker: string;
    text: string;
    translation?: string;
  }>;
  matching_pairs?: Array<{
    left: string;
    right: string;
    leftTranslation?: string;
    rightTranslation?: string;
  }>;
  definition_items?: Array<{
    word: string;
    hint?: string;
  }>;
  grammar_items?: Array<{
    pattern: string;
    hint?: string;
    example: string;
  }>;
  sentence_writing_items?: Array<{
    word: string;
    hint?: string;
  }>;
  article_content?: string;
  article_title?: string;
}

function CreateDrillPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drillId = searchParams.get("drillId") || searchParams.get("id");
  const isEditMode = !!drillId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [existingDrill, setExistingDrill] = useState<any>(null);
  const [parsedContent, setParsedContent] = useState<ParsedContent | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const [formData, setFormData] = useState<DrillFormData>(() => {
    if (isEditMode) {
      return null as any; // Will be set when drill loads
    }

    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        return JSON.parse(savedDraft);
      } catch (e) {
        // Invalid draft, use default
      }
    }

    return {
      title: "",
      date: new Date().toISOString().split("T")[0],
      duration_days: 1,
      type: "vocabulary",
      difficulty: "intermediate",
      assigned_to: [],
      context: "",
      target_sentences: [
        { word: "", wordTranslation: "", text: "", translation: "" },
      ],
      student_character_name: "",
      ai_character_names: [""],
      roleplay_scenes: [
        {
          scene_name: "Scene 1",
          context: "",
          dialogue: [
            { speaker: "ai_0", text: "", translation: "" },
            { speaker: "student", text: "", translation: "" },
          ],
        },
      ],
      roleplay_dialogue: [
        { speaker: "ai_0", text: "", translation: "" },
        { speaker: "student", text: "", translation: "" },
      ],
      matching_pairs: [
        { left: "", right: "", leftTranslation: "", rightTranslation: "" },
      ],
      definition_items: [{ word: "", hint: "" }],
      grammar_items: [{ pattern: "", hint: "", example: "" }],
      sentence_writing_items: [{ word: "", hint: "" }],
      article_content: "",
      article_title: "",
    };
  });

  // Load students
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const response = await tutorAPI.getStudents();
        setStudents(response.students || []);
      } catch (error) {
        console.error("Failed to load students:", error);
      }
    };
    loadStudents();
  }, []);

  // Load existing drill in edit mode
  useEffect(() => {
    const loadDrill = async () => {
      if (isEditMode && drillId && !existingDrill) {
        setLoading(true);
        try {
          const response = await drillAPI.getById(drillId);
          const drill = response.drill;
          setExistingDrill(drill);

          const aiNames =
            drill.ai_character_names ||
            (drill.ai_character_name ? [drill.ai_character_name] : [""]);

          setFormData({
            title: drill.title || "",
            date: drill.date
              ? new Date(drill.date).toISOString().split("T")[0]
              : new Date().toISOString().split("T")[0],
            duration_days: drill.duration_days || 1,
            type: drill.type || "vocabulary",
            difficulty: drill.difficulty || "intermediate",
            assigned_to: Array.isArray(drill.assigned_to)
              ? drill.assigned_to
              : [drill.assigned_to],
            context: drill.context || "",
            audio_example_url: drill.audio_example_url,
            target_sentences:
              drill.target_sentences || [
                { text: "", translation: "" },
              ],
            student_character_name: drill.student_character_name || "",
            ai_character_names: aiNames,
            roleplay_scenes: drill.roleplay_scenes || [
              {
                scene_name: "Scene 1",
                context: "",
                dialogue: [
                  { speaker: "ai_0", text: "", translation: "" },
                  { speaker: "student", text: "", translation: "" },
                ],
              },
            ],
            roleplay_dialogue: drill.roleplay_dialogue || [
              { speaker: "ai_0", text: "", translation: "" },
              { speaker: "student", text: "", translation: "" },
            ],
            matching_pairs: drill.matching_pairs || [
              { left: "", right: "", leftTranslation: "", rightTranslation: "" },
            ],
            definition_items: drill.definition_items || [
              { word: "", hint: "" },
            ],
            grammar_items: drill.grammar_items || [
              { pattern: "", hint: "", example: "" },
            ],
            sentence_writing_items: drill.sentence_writing_items || [
              { word: "", hint: "" },
            ],
            article_content: drill.article_content || "",
            article_title: drill.article_title || "",
          });
        } catch (error) {
          console.error("Failed to load drill:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadDrill();
  }, [isEditMode, drillId, existingDrill]);

  // Auto-save draft
  useEffect(() => {
    if (!isEditMode && formData) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [formData, isEditMode]);

  // Handle file upload
  const handleFileSelect = async (file: File) => {
    try {
      setIsParsing(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/v1/drills/parse-document', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to parse document');
      }

      const result = await response.json();
      setParsedContent(result.data);
      setShowPreview(true);
      toast.success('Document parsed successfully');
    } catch (error: any) {
      toast.error('Failed to parse document: ' + error.message);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle clipboard parse
  const handleClipboardParse = (parsed: ParsedContent) => {
    setParsedContent(parsed);
    setShowPreview(true);
  };

  // Apply parsed content to form
  const handleApplyParsedContent = () => {
    if (!parsedContent) return;

    const { extractedData, type } = parsedContent;
    const { title, items, metadata } = extractedData;

    // Update form data
    const updatedFormData: any = { ...formData };

    // Set title if available
    if (title) {
      updatedFormData.title = title;
    }

    // Set type if detected with high confidence
    if (type !== 'unknown' && parsedContent.confidence >= 0.6) {
      updatedFormData.type = type;
    }

    // Set difficulty if detected
    if (metadata?.difficulty) {
      updatedFormData.difficulty = metadata.difficulty;
    }

    // Set context if available
    if (metadata?.context) {
      updatedFormData.context = metadata.context;
    }

    // Populate type-specific fields
    switch (type) {
      case 'vocabulary':
        updatedFormData.target_sentences = items.length > 0 ? items : [{ text: '', translation: '' }];
        break;
      case 'matching':
        updatedFormData.matching_pairs = items.length > 0 ? items : [{ left: '', right: '' }];
        break;
      case 'roleplay':
        updatedFormData.roleplay_scenes = items.length > 0 ? items : [{
          scene_name: 'Scene 1',
          dialogue: [{ speaker: 'ai_0', text: '' }, { speaker: 'student', text: '' }],
        }];
        break;
      case 'definition':
        updatedFormData.definition_items = items.length > 0 ? items : [{ word: '', hint: '' }];
        break;
      case 'grammar':
        updatedFormData.grammar_items = items.length > 0 ? items : [{ pattern: '', example: '', hint: '' }];
        break;
      case 'sentence_writing':
        updatedFormData.sentence_writing_items = items.length > 0 ? items : [{ word: '', hint: '' }];
        break;
      case 'summary':
        if (items.length > 0 && items[0].content) {
          updatedFormData.article_content = items[0].content;
        }
        if (title) {
          updatedFormData.article_title = title;
        }
        break;
    }

    setFormData(updatedFormData);
    setShowPreview(false);
    setParsedContent(null);
    toast.success('Form populated with parsed data');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.assigned_to.length === 0) {
      alert("Please select at least one student");
      return;
    }

    setSaving(true);
    try {
      const submitData: any = { ...formData };

      // Clean up data based on drill type
      if (formData.type === "roleplay") {
        delete submitData.target_sentences;
        delete submitData.matching_pairs;
        delete submitData.definition_items;
        delete submitData.grammar_items;
        delete submitData.sentence_writing_items;
        delete submitData.article_content;
        delete submitData.article_title;
        if (submitData.ai_character_name) {
          delete submitData.ai_character_name;
        }
      } else if (formData.type === "matching") {
        delete submitData.target_sentences;
        delete submitData.roleplay_dialogue;
        delete submitData.roleplay_scenes;
        delete submitData.student_character_name;
        delete submitData.ai_character_names;
        delete submitData.definition_items;
        delete submitData.grammar_items;
        delete submitData.sentence_writing_items;
        delete submitData.article_content;
        delete submitData.article_title;
      } else if (formData.type === "definition") {
        delete submitData.target_sentences;
        delete submitData.roleplay_dialogue;
        delete submitData.roleplay_scenes;
        delete submitData.student_character_name;
        delete submitData.ai_character_names;
        delete submitData.matching_pairs;
        delete submitData.grammar_items;
        delete submitData.sentence_writing_items;
        delete submitData.article_content;
        delete submitData.article_title;
      } else if (formData.type === "summary") {
        delete submitData.target_sentences;
        delete submitData.roleplay_dialogue;
        delete submitData.roleplay_scenes;
        delete submitData.student_character_name;
        delete submitData.ai_character_names;
        delete submitData.matching_pairs;
        delete submitData.definition_items;
        delete submitData.grammar_items;
        delete submitData.sentence_writing_items;
      } else if (formData.type === "grammar") {
        delete submitData.target_sentences;
        delete submitData.roleplay_dialogue;
        delete submitData.roleplay_scenes;
        delete submitData.student_character_name;
        delete submitData.ai_character_names;
        delete submitData.matching_pairs;
        delete submitData.definition_items;
        delete submitData.sentence_writing_items;
        delete submitData.article_content;
        delete submitData.article_title;
      } else if (formData.type === "sentence_writing") {
        delete submitData.target_sentences;
        delete submitData.roleplay_dialogue;
        delete submitData.roleplay_scenes;
        delete submitData.student_character_name;
        delete submitData.ai_character_names;
        delete submitData.matching_pairs;
        delete submitData.definition_items;
        delete submitData.grammar_items;
        delete submitData.article_content;
        delete submitData.article_title;
      } else {
        // vocabulary
        delete submitData.roleplay_dialogue;
        delete submitData.roleplay_scenes;
        delete submitData.student_character_name;
        delete submitData.ai_character_names;
        delete submitData.matching_pairs;
        delete submitData.definition_items;
        delete submitData.grammar_items;
        delete submitData.sentence_writing_items;
        delete submitData.article_content;
        delete submitData.article_title;
      }

      // Convert date to ISO string
      submitData.date = new Date(submitData.date).toISOString();

      if (isEditMode) {
        await drillAPI.update(drillId!, submitData);
        alert("Drill updated successfully!");
      } else {
        await drillAPI.create(submitData);
        localStorage.removeItem(DRAFT_KEY);
        alert(
          `Drill created for ${formData.assigned_to.length} student${
            formData.assigned_to.length !== 1 ? "s" : ""
          }!`
        );
      }

      router.push("/tutor/drills");
    } catch (error: any) {
      alert(error.message || "Failed to save drill");
    } finally {
      setSaving(false);
    }
  };

  if (loading || (isEditMode && !formData)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    );
  }

  if (!formData) return null;

  const isRoleplay = formData.type === "roleplay";
  const isMatching = formData.type === "matching";
  const isDefinition = formData.type === "definition";
  const isSummary = formData.type === "summary";
  const isGrammar = formData.type === "grammar";
  const isSentenceWriting = formData.type === "sentence_writing";
  const isVocabulary = formData.type === "vocabulary";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-6"></div>

      <div className="max-w-4xl mx-auto px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/tutor/drills">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? "Edit Drill" : "Create New Drill"}
            </h1>
            <p className="text-gray-600 mt-1 flex items-center gap-2">
              {isEditMode
                ? "Update drill details"
                : "Fill in the form to create a new drill"}
              {!isEditMode && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                  <Save className="w-3 h-3" />
                  Auto-saving
                </span>
              )}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <Card className="p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Basic Information
            </h2>
            <div className="space-y-4">
              {/* Student Assignment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-base font-semibold">
                  {isEditMode ? "Assigned to Student *" : "Assign to Students *"}
                  </Label>
                  {!isEditMode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (formData.assigned_to.length === students.length) {
                          setFormData({ ...formData, assigned_to: [] });
                        } else {
                          setFormData({
                            ...formData,
                            assigned_to: students.map((s) => s.email),
                          });
                        }
                      }}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      {formData.assigned_to.length === students.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-gray-50">
                  {students.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No students available
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {students.map((student) => (
                        <div
                          key={student.email}
                          className="flex items-center space-x-3 p-2 hover:bg-white rounded-md transition-colors"
                        >
                          <Checkbox
                            id={student.email}
                            checked={formData.assigned_to.includes(student.email)}
                            onChange={(e) => {
                              if (isEditMode) return;
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  assigned_to: [
                                    ...formData.assigned_to,
                                    student.email,
                                  ],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  assigned_to: formData.assigned_to.filter(
                                    (email) => email !== student.email
                                  ),
                                });
                              }
                            }}
                            disabled={isEditMode}
                          />
                          <label
                            htmlFor={student.email}
                            className={`flex-1 select-none ${
                              isEditMode ? "cursor-default" : "cursor-pointer"
                            }`}
                          >
                            <div className="font-medium text-gray-900">
                              {student.firstName} {student.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {student.email}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formData.assigned_to.length > 0 && (
                  <p className="text-sm text-green-600 font-medium mt-2">
                    {formData.assigned_to.length} student
                    {formData.assigned_to.length !== 1 ? "s" : ""} selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Drill Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Daily Practice - Restaurant Phrases"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="date">Start Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration (Days) *</Label>
                  <Select
                    value={String(formData.duration_days)}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        duration_days: parseInt(e.target.value),
                      })
                    }
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                      <option key={days} value={days}>
                        {days} Day{days !== 1 ? "s" : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="type">Drill Type *</Label>
                    {!isEditMode && (
                      <TemplateDownload drillType={formData.type} />
                    )}
                  </div>
                  <Select
                    id="type"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                  >
                    <option value="vocabulary">Vocabulary</option>
                    <option value="roleplay">Role-play</option>
                    <option value="matching">Matching</option>
                    <option value="definition">Definition</option>
                    <option value="summary">Summary</option>
                    <option value="grammar">Grammar</option>
                    <option value="sentence_writing">Sentence Writing</option>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="difficulty">Difficulty *</Label>
                  <Select
                    value={formData.difficulty}
                    onChange={(e) =>
                      setFormData({ ...formData, difficulty: e.target.value })
                    }
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </Select>
                </div>
              </div>

              {/* Roleplay specific fields */}
              {isRoleplay && (
                <>
                  <div>
                    <Label htmlFor="context">Context / Scenario *</Label>
                    <Textarea
                      id="context"
                      value={formData.context}
                      onChange={(e) =>
                        setFormData({ ...formData, context: e.target.value })
                      }
                      placeholder="e.g., You're at a restaurant ordering dinner"
                      rows={3}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="student_character">
                      Student&apos;s Character Name *
                    </Label>
                    <Input
                      id="student_character"
                      value={formData.student_character_name || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          student_character_name: e.target.value,
                        })
                      }
                      placeholder="e.g., Customer, Patient, Tourist"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-base font-semibold">
                        AI Character Names * (1-3 characters)
                      </Label>
                      {(formData.ai_character_names || []).length < 3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              ai_character_names: [
                                ...(formData.ai_character_names || []),
                                "",
                              ],
                            });
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add AI Character
                        </Button>
                      )}
                    </div>
                    {(formData.ai_character_names || []).map((name, index) => (
                      <div key={index} className="flex items-center gap-3 mb-2">
                        <Input
                          value={name}
                          onChange={(e) => {
                            const newNames = [...(formData.ai_character_names || [])];
                            newNames[index] = e.target.value;
                            setFormData({
                              ...formData,
                              ai_character_names: newNames,
                            });
                          }}
                          placeholder={`e.g., ${
                            index === 0
                              ? "Waiter"
                              : index === 1
                              ? "Manager"
                              : "Host"
                          }`}
                          required
                        />
                        {(formData.ai_character_names || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newNames = (formData.ai_character_names || []).filter(
                                (_, i) => i !== index
                              );
                              setFormData({
                                ...formData,
                                ai_character_names: newNames,
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Import Section */}
              {!isEditMode && (
                <div className="border-t pt-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Import Data</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Upload a file, paste from clipboard, or download a template to get started quickly
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* File Upload */}
                    <div>
                      <Label className="mb-2 block">Upload Document</Label>
                      <FileUploadZone
                        onFileSelect={handleFileSelect}
                        disabled={isParsing}
                      />
                    </div>

                    {/* Clipboard Paste */}
                    <div>
                      <Label className="mb-2 block">Or Paste from Clipboard</Label>
                      <ClipboardPaste
                        onParse={handleClipboardParse}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Context for other types */}
              {!isRoleplay && (
                <div>
                  <Label htmlFor="context">Context (Optional)</Label>
                  <Textarea
                    id="context"
                    value={formData.context}
                    onChange={(e) =>
                      setFormData({ ...formData, context: e.target.value })
                    }
                    placeholder="Additional context or notes"
                    rows={2}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="audio">Example Pronunciation (Optional)</Label>
                {existingDrill?.audio_example_url && (
                  <div className="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 mb-2">
                      Current audio file:
                    </p>
                    <audio
                      controls
                      src={existingDrill.audio_example_url}
                      className="w-full"
                    />
                  </div>
                )}
                <Input
                  id="audio"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => {
                    // Handle audio file upload
                    // For now, we'll need to upload to a file service
                    console.log("Audio file selected:", e.target.files?.[0]);
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Type-specific Content Sections */}
          {isRoleplay && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Roleplay Scenes *
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Create multiple scenes for your roleplay
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      roleplay_scenes: [
                        ...(formData.roleplay_scenes || []),
                        {
                          scene_name: `Scene ${(formData.roleplay_scenes || []).length + 1}`,
                          context: "",
                          dialogue: [
                            { speaker: "ai_0", text: "", translation: "" },
                            { speaker: "student", text: "", translation: "" },
                          ],
                        },
                      ],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Scene
                </Button>
              </div>
              <div className="space-y-6">
                {(formData.roleplay_scenes || []).map((scene, sceneIndex) => (
                  <Card key={sceneIndex} className="border-purple-200 bg-purple-50/20">
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <Input
                          value={scene.scene_name}
                          onChange={(e) => {
                            const scenes = [...(formData.roleplay_scenes || [])];
                            scenes[sceneIndex].scene_name = e.target.value;
                            setFormData({ ...formData, roleplay_scenes: scenes });
                          }}
                          placeholder="Scene name"
                          className="max-w-xs font-semibold"
                          required
                        />
                        {(formData.roleplay_scenes || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                roleplay_scenes: (formData.roleplay_scenes || []).filter(
                                  (_, i) => i !== sceneIndex
                                ),
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-3 mb-4">
                        <Label>Scene Context (Optional)</Label>
                        <Input
                          value={scene.context || ""}
                          onChange={(e) => {
                            const scenes = [...(formData.roleplay_scenes || [])];
                            scenes[sceneIndex].context = e.target.value;
                            setFormData({ ...formData, roleplay_scenes: scenes });
                          }}
                          placeholder="Scene-specific context"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Dialogue</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const scenes = [...(formData.roleplay_scenes || [])];
                              const dialogue = scenes[sceneIndex].dialogue || [];
                              const lastTurn = dialogue[dialogue.length - 1];
                              const nextSpeaker =
                                lastTurn?.speaker === "student" ? "ai_0" : "student";
                              scenes[sceneIndex].dialogue = [
                                ...dialogue,
                                { speaker: nextSpeaker, text: "", translation: "" },
                              ];
                              setFormData({ ...formData, roleplay_scenes: scenes });
                            }}
                          >
                            <Plus className="w-3 h-3 mr-2" />
                            Add Turn
                          </Button>
                        </div>
                        {(scene.dialogue || []).map((turn, turnIndex) => (
                          <Card
                            key={turnIndex}
                            className={`${
                              turn.speaker === "student"
                                ? "border-blue-200 bg-blue-50/30"
                                : "border-purple-200 bg-purple-50/30"
                            }`}
                          >
                            <div className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-1">
                                  <Select
                                    value={turn.speaker}
                                    onChange={(e) => {
                                      const scenes = [...(formData.roleplay_scenes || [])];
                                      scenes[sceneIndex].dialogue[turnIndex].speaker =
                                        e.target.value;
                                      setFormData({ ...formData, roleplay_scenes: scenes });
                                    }}
                                    className="w-32 h-8 text-xs"
                                  >
                                    <option value="student">
                                      {formData.student_character_name || "Student"}
                                    </option>
                                    {(formData.ai_character_names || []).map(
                                      (name, aiIndex) => (
                                        <option key={aiIndex} value={`ai_${aiIndex}`}>
                                          {name || `AI ${aiIndex + 1}`}
                                        </option>
                                      )
                                    )}
                                  </Select>
                                </div>
                                {(scene.dialogue || []).length > 2 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const scenes = [...(formData.roleplay_scenes || [])];
                                      scenes[sceneIndex].dialogue = scenes[
                                        sceneIndex
                                      ].dialogue.filter((_, i) => i !== turnIndex);
                                      setFormData({ ...formData, roleplay_scenes: scenes });
                                    }}
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-3">
                                <Input
                                  value={turn.text}
                                  onChange={(e) => {
                                    const scenes = [...(formData.roleplay_scenes || [])];
                                    scenes[sceneIndex].dialogue[turnIndex].text =
                                      e.target.value;
                                    setFormData({ ...formData, roleplay_scenes: scenes });
                                  }}
                                  placeholder="English text"
                                  required
                                />
                                <Input
                                  value={turn.translation || ""}
                                  onChange={(e) => {
                                    const scenes = [...(formData.roleplay_scenes || [])];
                                    scenes[sceneIndex].dialogue[turnIndex].translation =
                                      e.target.value;
                                    setFormData({ ...formData, roleplay_scenes: scenes });
                                  }}
                                  placeholder="한국어 번역 (선택사항)"
                                />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {isVocabulary && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Vocabulary Items *
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      target_sentences: [
                        ...(formData.target_sentences || []),
                        { word: "", wordTranslation: "", text: "", translation: "" },
                      ],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vocabulary Item
                </Button>
              </div>
              <div className="space-y-6">
                {(formData.target_sentences || []).map((item, index) => (
                  <Card key={index} className="border-blue-100 bg-blue-50/20">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">
                          Vocabulary Item {index + 1}
                        </h4>
                        {(formData.target_sentences || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                target_sentences: (formData.target_sentences || []).filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label>Vocabulary Word *</Label>
                          <Input
                            value={item.word || ""}
                            onChange={(e) => {
                              const sentences = [...(formData.target_sentences || [])];
                              sentences[index].word = e.target.value;
                              setFormData({ ...formData, target_sentences: sentences });
                            }}
                            placeholder="e.g., restaurant"
                            required
                          />
                        </div>
                        <div>
                          <Label>Korean Translation for Word (Optional)</Label>
                          <Input
                            value={item.wordTranslation || ""}
                            onChange={(e) => {
                              const sentences = [...(formData.target_sentences || [])];
                              sentences[index].wordTranslation = e.target.value;
                              setFormData({ ...formData, target_sentences: sentences });
                            }}
                            placeholder="e.g., 식당"
                          />
                        </div>
                        <div>
                          <Label>Practice Sentence (containing the word) *</Label>
                          <Input
                            value={item.text}
                            onChange={(e) => {
                              const sentences = [...(formData.target_sentences || [])];
                              sentences[index].text = e.target.value;
                              setFormData({ ...formData, target_sentences: sentences });
                            }}
                            placeholder="e.g., I went to the restaurant yesterday"
                            required
                          />
                        </div>
                        <div>
                          <Label>Korean Translation for Sentence (Optional)</Label>
                          <Input
                            value={item.translation || ""}
                            onChange={(e) => {
                              const sentences = [...(formData.target_sentences || [])];
                              sentences[index].translation = e.target.value;
                              setFormData({ ...formData, target_sentences: sentences });
                            }}
                            placeholder="e.g., 나는 어제 식당에 갔다"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {isMatching && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Matching Pairs *
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      matching_pairs: [
                        ...(formData.matching_pairs || []),
                        { left: "", right: "", leftTranslation: "", rightTranslation: "" },
                      ],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pair
                </Button>
              </div>
              <div className="space-y-6">
                {(formData.matching_pairs || []).map((pair, index) => (
                  <Card key={index} className="border-purple-100">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Pair {index + 1}</h4>
                        {(formData.matching_pairs || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                matching_pairs: (formData.matching_pairs || []).filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label>Left Side *</Label>
                            <Input
                              value={pair.left}
                              onChange={(e) => {
                                const pairs = [...(formData.matching_pairs || [])];
                                pairs[index].left = e.target.value;
                                setFormData({ ...formData, matching_pairs: pairs });
                              }}
                              placeholder="e.g., Hello"
                              required
                            />
                          </div>
                          <div>
                            <Label>Left Translation (Optional)</Label>
                            <Input
                              value={pair.leftTranslation || ""}
                              onChange={(e) => {
                                const pairs = [...(formData.matching_pairs || [])];
                                pairs[index].leftTranslation = e.target.value;
                                setFormData({ ...formData, matching_pairs: pairs });
                              }}
                              placeholder="e.g., 안녕하세요"
                            />
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label>Right Side *</Label>
                            <Input
                              value={pair.right}
                              onChange={(e) => {
                                const pairs = [...(formData.matching_pairs || [])];
                                pairs[index].right = e.target.value;
                                setFormData({ ...formData, matching_pairs: pairs });
                              }}
                              placeholder="e.g., 안녕하세요"
                              required
                            />
                          </div>
                          <div>
                            <Label>Right Translation (Optional)</Label>
                            <Input
                              value={pair.rightTranslation || ""}
                              onChange={(e) => {
                                const pairs = [...(formData.matching_pairs || [])];
                                pairs[index].rightTranslation = e.target.value;
                                setFormData({ ...formData, matching_pairs: pairs });
                              }}
                              placeholder="e.g., Korean greeting"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {isDefinition && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Definition Items *
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      definition_items: [
                        ...(formData.definition_items || []),
                        { word: "", hint: "" },
                      ],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Word
                </Button>
              </div>
              <div className="space-y-6">
                {(formData.definition_items || []).map((item, index) => (
                  <Card key={index} className="border-cyan-100">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Word {index + 1}</h4>
                        {(formData.definition_items || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                definition_items: (formData.definition_items || []).filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label>Word / Expression *</Label>
                          <Input
                            value={item.word}
                            onChange={(e) => {
                              const items = [...(formData.definition_items || [])];
                              items[index].word = e.target.value;
                              setFormData({ ...formData, definition_items: items });
                            }}
                            placeholder="e.g., Abundant"
                            required
                          />
                        </div>
                        <div>
                          <Label>Hint (Optional)</Label>
                          <Input
                            value={item.hint || ""}
                            onChange={(e) => {
                              const items = [...(formData.definition_items || [])];
                              items[index].hint = e.target.value;
                              setFormData({ ...formData, definition_items: items });
                            }}
                            placeholder="e.g., Think of 'a lot of something'"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {isGrammar && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Grammar Patterns *
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      grammar_items: [
                        ...(formData.grammar_items || []),
                        { pattern: "", hint: "", example: "" },
                      ],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Pattern
                </Button>
              </div>
              <div className="space-y-6">
                {(formData.grammar_items || []).map((item, index) => (
                  <Card key={index} className="border-violet-100">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">
                          Pattern {index + 1}
                        </h4>
                        {(formData.grammar_items || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                grammar_items: (formData.grammar_items || []).filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label>Grammar Pattern *</Label>
                          <Input
                            value={item.pattern}
                            onChange={(e) => {
                              const items = [...(formData.grammar_items || [])];
                              items[index].pattern = e.target.value;
                              setFormData({ ...formData, grammar_items: items });
                            }}
                            placeholder="e.g., Used to + verb"
                            required
                          />
                        </div>
                        <div>
                          <Label>Example Sentence (Optional)</Label>
                          <Input
                            value={item.example || ""}
                            onChange={(e) => {
                              const items = [...(formData.grammar_items || [])];
                              items[index].example = e.target.value;
                              setFormData({ ...formData, grammar_items: items });
                            }}
                            placeholder="e.g., I used to play basketball every day"
                          />
                        </div>
                        <div>
                          <Label>Hint (Optional)</Label>
                          <Input
                            value={item.hint || ""}
                            onChange={(e) => {
                              const items = [...(formData.grammar_items || [])];
                              items[index].hint = e.target.value;
                              setFormData({ ...formData, grammar_items: items });
                            }}
                            placeholder="e.g., Describes past habits or states"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {isSentenceWriting && (
            <Card className="p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Words for Sentence Writing *
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      sentence_writing_items: [
                        ...(formData.sentence_writing_items || []),
                        { word: "", hint: "" },
                      ],
                    });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Word
                </Button>
              </div>
              <div className="space-y-6">
                {(formData.sentence_writing_items || []).map((item, index) => (
                  <Card key={index} className="border-fuchsia-100">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Word {index + 1}</h4>
                        {(formData.sentence_writing_items || []).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                sentence_writing_items: (
                                  formData.sentence_writing_items || []
                                ).filter((_, i) => i !== index),
                              });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="space-y-4">
                        <div>
                          <Label>Word / Expression *</Label>
                          <Input
                            value={item.word}
                            onChange={(e) => {
                              const items = [...(formData.sentence_writing_items || [])];
                              items[index].word = e.target.value;
                              setFormData({ ...formData, sentence_writing_items: items });
                            }}
                            placeholder="e.g., Innovation"
                            required
                          />
                        </div>
                        <div>
                          <Label>Hint (Optional)</Label>
                          <Input
                            value={item.hint || ""}
                            onChange={(e) => {
                              const items = [...(formData.sentence_writing_items || [])];
                              items[index].hint = e.target.value;
                              setFormData({ ...formData, sentence_writing_items: items });
                            }}
                            placeholder="e.g., Think about new ideas and improvements"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {isSummary && (
            <Card className="p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Article for Summary *
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="article_title">Article Title *</Label>
                  <Input
                    id="article_title"
                    value={formData.article_title || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, article_title: e.target.value })
                    }
                    placeholder="e.g., Climate Change Effects on Ocean Life"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="article_content">Article Content *</Label>
                  <Textarea
                    id="article_content"
                    value={formData.article_content || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, article_content: e.target.value })
                    }
                    placeholder="Paste the article text here..."
                    rows={12}
                    required
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Copy and paste the news article text for students to read and
                    summarize.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="flex justify-end gap-4">
            <Link href="/tutor/drills">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditMode
                    ? "Update Drill"
                    : `Create Drill for ${formData.assigned_to.length} Student${
                        formData.assigned_to.length !== 1 ? "s" : ""
                      }`}
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Content Preview Modal */}
        {showPreview && parsedContent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <ContentPreview
                parsedContent={parsedContent}
                onConfirm={handleApplyParsedContent}
                onCancel={() => {
                  setShowPreview(false);
                  setParsedContent(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreateDrillPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-green-600" />
      </div>
    }>
      <CreateDrillPageContent />
    </Suspense>
  );
}
