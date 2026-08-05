import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { useRef } from 'react'
import * as api from '../services/api'
import './RichTextEditor.css'

type RichTextEditorProps = {
  value: string
  onChange: (html: string) => void
  id?: string
  ariaLabel?: string
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`rte-toolbar-btn${active ? ' rte-toolbar-btn-active' : ''}`}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor, onPickImage }: { editor: Editor; onPickImage: () => void }) {
  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Định dạng văn bản">
      <ToolbarButton label="Đậm" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton label="Nghiêng" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton label="Gạch chân" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton label="Gạch ngang" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </ToolbarButton>
      <span className="rte-toolbar-divider" />
      <ToolbarButton label="Tiêu đề 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolbarButton>
      <ToolbarButton label="Tiêu đề 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolbarButton>
      <span className="rte-toolbar-divider" />
      <ToolbarButton label="Danh sách gạch đầu dòng" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •≡
      </ToolbarButton>
      <ToolbarButton label="Danh sách đánh số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1≡
      </ToolbarButton>
      <ToolbarButton label="Trích dẫn" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        "
      </ToolbarButton>
      <span className="rte-toolbar-divider" />
      <ToolbarButton
        label="Chèn liên kết"
        active={editor.isActive('link')}
        onClick={() => {
          const previousUrl = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('Nhập địa chỉ liên kết:', previousUrl ?? 'https://')
          if (url === null) return
          if (url.trim() === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
        }}
      >
        🔗
      </ToolbarButton>
      <ToolbarButton label="Chèn ảnh" onClick={onPickImage}>
        🖼
      </ToolbarButton>
    </div>
  )
}

/**
 * Rich-text editor for article body content, built on Tiptap. Emits sanitized
 * HTML via `onChange`; the server independently re-sanitizes on save, so this
 * component doesn't need its own sanitization step.
 */
export default function RichTextEditor({ value, onChange, id, ariaLabel }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } },
      }),
      Image,
    ],
    content: value,
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getHTML())
    },
    editorProps: {
      attributes: {
        id: id ?? '',
        'aria-label': ariaLabel ?? 'Nội dung bài viết',
        class: 'rte-content',
      },
    },
  })

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    try {
      const { url } = await api.uploadArticleImage(file)
      editor.chain().focus().setImage({ src: url }).run()
    } catch {
      window.alert('Tải ảnh lên thất bại. Vui lòng thử lại.')
    }
  }

  if (!editor) return null

  return (
    <div className="rte-wrapper">
      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Chọn ảnh để chèn vào nội dung"
        onChange={handleFileSelected}
      />
      <EditorContent editor={editor} />
    </div>
  )
}
