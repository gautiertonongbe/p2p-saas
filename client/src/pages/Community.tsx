import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
import { PageHeader } from "@/components/PageHeader";
  MessageSquare, Lightbulb, Megaphone, Users, ThumbsUp,
  CheckCircle, Pin, Search, Plus, X, Send, Eye, Loader2,
  HelpCircle, ArrowLeft, ChevronRight
} from "lucide-react";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 60) return `il y a ${m}min`;
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${days}j`;
}

const POST_TYPES = {
  question:     { label: "Question",    icon: HelpCircle,   color: "bg-blue-100 text-blue-700",    border: "border-blue-200" },
  tip:          { label: "Astuce",      icon: Lightbulb,    color: "bg-amber-100 text-amber-700",   border: "border-amber-200" },
  announcement: { label: "Annonce",     icon: Megaphone,    color: "bg-purple-100 text-purple-700", border: "border-purple-200" },
  discussion:   { label: "Discussion",  icon: MessageSquare, color: "bg-gray-100 text-gray-700",   border: "border-gray-200" },
};

function getInitials(name: string) {
  return (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  const colors = ["bg-blue-200 text-blue-800", "bg-emerald-200 text-emerald-800", "bg-purple-200 text-purple-800", "bg-amber-200 text-amber-800"];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return <div className={`${s} ${color} rounded-full flex items-center justify-center font-semibold shrink-0`}>{getInitials(name)}</div>;
}

// ── Post Detail View ──────────────────────────────────────────────────────────
function PostDetail({ postId, onBack }: { postId: number; onBack: () => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [reply, setReply] = useState("");

  const { data: post, isLoading } = trpc.community.getPost.useQuery({ id: postId });

  const replyMut = trpc.community.createReply.useMutation({
    onSuccess: () => { setReply(""); utils.community.getPost.invalidate({ id: postId }); toast.success("Réponse publiée"); },
    onError: (e) => toast.error(e.message),
  });
  const reactMut = trpc.community.react.useMutation({
    onSuccess: () => utils.community.getPost.invalidate({ id: postId }),
  });
  const acceptMut = trpc.community.acceptAnswer.useMutation({
    onSuccess: () => utils.community.getPost.invalidate({ id: postId }),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!post) return null;

  const pt = POST_TYPES[(post as any).type as keyof typeof POST_TYPES] || POST_TYPES.discussion;
  const Icon = pt.icon;

  return (
    <div className="space-y-4">
      <PageHeader icon={<Users className="h-5 w-5" />} title="Communauté" description="Posez des questions, partagez des astuces" />
<button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />Retour à la communauté
      </button>

      {/* Post */}
      <Card className={`border-l-4 ${pt.border}`}>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Avatar name={(post as any).authorName} size="md" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${pt.color}`}>
                    <Icon className="h-3 w-3" />{pt.label}
                  </span>
                  {(post as any).isPinned && <span className="text-xs text-purple-600 flex items-center gap-1"><Pin className="h-3 w-3" />Épinglé</span>}
                  {(post as any).isResolved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Résolu</span>}
                </div>
                <h2 className="text-lg font-semibold">{(post as any).title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(post as any).authorName} · {timeAgo((post as any).createdAt)} · <Eye className="h-3 w-3 inline" /> {(post as any).views} vues
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-700 pl-12">
            {(post as any).content}
          </div>
          {(post as any).tags && (
            <div className="flex gap-1 flex-wrap mt-3 pl-12">
              {(post as any).tags.split(",").map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">#{tag.trim()}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 mt-4 pl-12">
            <button onClick={() => reactMut.mutate({ entityType: "post", entityId: (post as any).id })}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-600 transition-colors">
              <ThumbsUp className="h-3.5 w-3.5" />{(post as any).helpfulCount} utile
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      {((post as any).replies || []).length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{(post as any).replies.length} réponse(s)</p>
          {((post as any).replies as any[]).map((r: any) => (
            <Card key={r.id} className={r.isAcceptedAnswer ? "border-emerald-300 bg-emerald-50/30" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Avatar name={r.authorName} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.authorName}</span>
                      <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                      {r.isAcceptedAnswer && (
                        <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />Meilleure réponse
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-2 leading-relaxed whitespace-pre-wrap text-gray-700">{r.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => reactMut.mutate({ entityType: "reply", entityId: r.id })}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-blue-600">
                        <ThumbsUp className="h-3 w-3" />{r.helpfulCount} utile
                      </button>
                      {(post as any).authorId === user?.id && !r.isAcceptedAnswer && (post as any).type === "question" && (
                        <button onClick={() => acceptMut.mutate({ replyId: r.id, postId: (post as any).id })}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                          ✓ Marquer comme meilleure réponse
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reply box */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <Label className="text-sm font-medium">Votre réponse</Label>
          <Textarea value={reply} onChange={e => setReply(e.target.value)}
            placeholder="Partagez votre expérience, conseil ou solution..." rows={3} />
          <div className="flex justify-end">
            <button onClick={() => replyMut.mutate({ postId: postId, content: reply })}
              disabled={reply.trim().length < 5 || replyMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white btn-primary disabled:opacity-50">
              {replyMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Publier ma réponse
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── New Post Form ─────────────────────────────────────────────────────────────
function NewPostForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "procurement_manager";
  const [type, setType] = useState<"question" | "tip" | "announcement" | "discussion">("question");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const createMut = trpc.community.createPost.useMutation({
    onSuccess: () => { toast.success("Publication créée !"); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Nouvelle publication</CardTitle>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.entries(POST_TYPES) as any[]).filter(([k]) => k !== "announcement" || isAdmin).map(([key, pt]: any) => {
            const Icon = pt.icon;
            return (
              <button key={key} onClick={() => setType(key as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  type === key ? `${pt.color} ${pt.border} border-2` : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}>
                <Icon className="h-4 w-4" />{pt.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label>Titre *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)}
            placeholder={type === "question" ? "Quelle est votre question ?" :
              type === "tip" ? "Quel conseil voulez-vous partager ?" :
              type === "announcement" ? "Titre de l'annonce" : "Sujet de la discussion"} />
        </div>
        <div className="space-y-1.5">
          <Label>Contenu *</Label>
          <Textarea value={content} onChange={e => setContent(e.target.value)}
            rows={4} placeholder="Décrivez en détail votre question, astuce ou sujet..." />
        </div>
        <div className="space-y-1.5">
          <Label>Tags <span className="text-muted-foreground font-normal">(séparés par virgule)</span></Label>
          <Input value={tags} onChange={e => setTags(e.target.value)}
            placeholder="ex: approbations, fournisseurs, factures" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
          <button onClick={() => createMut.mutate({ type, title, content, tags: tags || undefined })}
            disabled={!title.trim() || content.trim().length < 10 || createMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white btn-primary disabled:opacity-50">
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Publier
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Community Page ───────────────────────────────────────────────────────
export default function Community() {
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [showNewPost, setShowNewPost] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const utils = trpc.useUtils();

  const { data: posts = [], isLoading } = trpc.community.listPosts.useQuery({
    type: typeFilter || undefined,
    search: search || undefined,
  });

  const { data: stats } = trpc.community.stats.useQuery();

  if (selectedPostId) {
    return (
      <div className="max-w-3xl mx-auto pb-8">
        <PostDetail postId={selectedPostId} onBack={() => setSelectedPostId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Questions ouvertes", value: (stats as any)?.openQuestions || 0, icon: HelpCircle, color: "text-blue-600" },
          { label: "Astuces partagées", value: (stats as any)?.tips || 0, icon: Lightbulb, color: "text-amber-600" },
          { label: "Annonces", value: (stats as any)?.announcements || 0, icon: Megaphone, color: "text-purple-600" },
          { label: "Total publications", value: (stats as any)?.totalPosts || 0, icon: MessageSquare, color: "text-gray-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color} opacity-80`} />
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New post form */}
      {showNewPost && (
        <NewPostForm
          onClose={() => setShowNewPost(false)}
          onCreated={() => { setShowNewPost(false); utils.community.listPosts.invalidate(); }}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..." className="pl-9" />
        </div>
        <div className="flex rounded-lg border overflow-hidden">
          {[
            { id: "", label: "Tout" },
            { id: "question", label: "Questions" },
            { id: "tip", label: "Astuces" },
            { id: "announcement", label: "Annonces" },
            { id: "discussion", label: "Discussions" },
          ].map(f => (
            <button key={f.id} onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${typeFilter === f.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (posts as any[]).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">Aucune publication pour l'instant</p>
            <p className="text-sm text-muted-foreground mt-1">Soyez le premier à poser une question ou partager une astuce !</p>
            <button onClick={() => setShowNewPost(true)}
              className="mt-4 px-4 py-2 rounded-lg text-sm btn-primary text-white">
              Créer la première publication
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(posts as any[]).map((post: any) => {
            const pt = POST_TYPES[post.type as keyof typeof POST_TYPES] || POST_TYPES.discussion;
            const Icon = pt.icon;
            return (
              <Card key={post.id}
                className={`hover:shadow-md transition-all cursor-pointer ${post.isPinned ? "border-purple-200 bg-purple-50/20" : ""}`}
                onClick={() => setSelectedPostId(post.id)}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={post.authorName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${pt.color}`}>
                          <Icon className="h-3 w-3" />{pt.label}
                        </span>
                        {post.isPinned && <Pin className="h-3.5 w-3.5 text-purple-500" />}
                        {post.isResolved && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                        {post.tags && post.tags.split(",").slice(0, 2).map((tag: string) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-xs text-muted-foreground">#{tag.trim()}</span>
                        ))}
                      </div>
                      <p className="font-semibold text-sm mt-1 truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.content}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                        <MessageSquare className="h-3.5 w-3.5" />{post.replyCount}
                        <ThumbsUp className="h-3.5 w-3.5" />{post.helpfulCount}
                        <Eye className="h-3.5 w-3.5" />{post.views}
                      </div>
                      <p className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
