import {
  ArrowLeft,
  FileText,
  Type,
  Layout,
  ListOrdered,
  Image,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

interface Phase2GuidelinesPageProps {
  onBack: () => void;
}

export function Phase2GuidelinesPage({ onBack }: Phase2GuidelinesPageProps) {
  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Top back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:text-brand-accent transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Phase 2
      </button>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border-2 border-yellow-400 text-black mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-yellow-100 text-yellow-900 border border-yellow-300 mb-3">
          <BookOpen className="w-3.5 h-3.5" /> Official Conference Documentation
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-brand-text mb-3">
          Phase 2 Guidelines
        </h1>
        <h2 className="text-base sm:text-lg font-semibold text-brand-text/80 mb-2">
          Camera-Ready Paper Guidelines
        </h2>
        <p className="text-sm sm:text-base text-black/75 leading-relaxed">
          Authors must prepare the final camera-ready version of their paper strictly according to
          the following guidelines, using the official conference template.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Title, Text and Keywords */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border border-stone-200 text-black">
          <div className="flex items-center gap-2.5 pb-3 border-b border-stone-200 mb-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-900 flex items-center justify-center font-bold">
              <Type className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text">
                Title, Text and Keywords
              </h3>
              <p className="text-xs text-black/60">Font sizing, alignment, and formatting rules</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                1
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The <strong>paper title</strong> must be set in <strong>bold, 14 pt font</strong> and <strong>centered</strong> on the page, and the <strong>author details</strong> must be written in <strong>9 pt regular font</strong>.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                2
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The <strong>body text</strong> must be set in <strong>10 pt font</strong> and <strong>justified</strong>, and the <strong>keywords</strong> must be written in <strong>10 pt regular font</strong>.
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Page Setup */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border border-stone-200 text-black">
          <div className="flex items-center gap-2.5 pb-3 border-b border-stone-200 mb-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-900 flex items-center justify-center font-bold">
              <Layout className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text">
                Page Setup
              </h3>
              <p className="text-xs text-black/60">Margins, orientation, and layout header/footer distances</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                3
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The document must use custom margins of <strong>5.7 cm at the top</strong>, <strong>5.7 cm at the bottom</strong>, <strong>4.5 cm on the left</strong> and <strong>4.5 cm on the right</strong>, with a gutter of <strong>0 cm</strong> and the gutter position set to <strong>Left</strong>.
              </div>
            </div>

            {/* Visual Margin Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 text-center">
                <span className="block text-[11px] font-bold text-yellow-900 uppercase tracking-wide">Top Margin</span>
                <span className="text-base font-extrabold text-black">5.7 cm</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 text-center">
                <span className="block text-[11px] font-bold text-yellow-900 uppercase tracking-wide">Bottom Margin</span>
                <span className="text-base font-extrabold text-black">5.7 cm</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 text-center">
                <span className="block text-[11px] font-bold text-yellow-900 uppercase tracking-wide">Left Margin</span>
                <span className="text-base font-extrabold text-black">4.5 cm</span>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-2.5 text-center">
                <span className="block text-[11px] font-bold text-yellow-900 uppercase tracking-wide">Right Margin</span>
                <span className="text-base font-extrabold text-black">4.5 cm</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                4
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The page orientation must be <strong>portrait</strong>, and the page setup must apply to the whole document, with the section starting on a <strong>new page</strong> and the vertical alignment set to <strong>Top</strong>.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                5
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The <strong>&quot;Different First Page&quot;</strong> and <strong>&quot;Different Odd &amp; Even Pages&quot;</strong> options must both be enabled in the layout settings.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                6
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The <strong>header</strong> must be placed <strong>4.7 cm</strong> from the edge of the page, and the <strong>footer</strong> must be placed <strong>0 cm</strong> from the edge.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                13
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                <strong>No.of Pages to be 10</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Headings */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border border-stone-200 text-black">
          <div className="flex items-center gap-2.5 pb-3 border-b border-stone-200 mb-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-900 flex items-center justify-center font-bold">
              <ListOrdered className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text">
                Headings
              </h3>
              <p className="text-xs text-black/60">Heading 1 and Heading 2 multilevel numbering styles</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                7
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                <strong>First-level headings</strong> (Heading 1 style) must follow the multilevel numbering format <code>[Chapter Number].[Section Number]</code>, for example <code className="bg-yellow-100 text-black px-1.5 py-0.5 rounded font-mono font-bold text-xs">1.1 Introduction</code> for Chapter 1 or <code className="bg-yellow-100 text-black px-1.5 py-0.5 rounded font-mono font-bold text-xs">2.1 Introduction</code> for Chapter 2.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                8
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                <strong>Subsections</strong> (Heading 2 style) must follow the format <code>[Chapter].[Section].[Subsection]</code>, for example <code className="bg-yellow-100 text-black px-1.5 py-0.5 rounded font-mono font-bold text-xs">1.1.1 Background</code>.
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Figures and Tables */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border border-stone-200 text-black">
          <div className="flex items-center gap-2.5 pb-3 border-b border-stone-200 mb-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-900 flex items-center justify-center font-bold">
              <Image className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text">
                Figures and Tables
              </h3>
              <p className="text-xs text-black/60">Caption text, alignment, styling, and numbering rules</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                9
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                <strong>Figure captions</strong> must be set in <strong>9 pt font</strong> and <strong>centered</strong>, with the <em>&quot;Figure X.Y&quot;</em> label in <strong>italics</strong>, where X is the chapter number.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                10
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                <strong>Table captions</strong> must be set in <strong>9 pt font</strong> and <strong>centered</strong>, with the label in <strong>bold italics</strong> and numbered in the <code>[Chapter].[Table Number]</code> format.
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Citations and References */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border border-stone-200 text-black">
          <div className="flex items-center gap-2.5 pb-3 border-b border-stone-200 mb-4">
            <div className="w-9 h-9 rounded-xl bg-yellow-100 text-yellow-900 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-brand-text" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text">
                Citations and References
              </h3>
              <p className="text-xs text-black/60">Citation format, Harvard referencing, and bibliography indentation</p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                11
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                <strong>Citations</strong> must be numbered inside <strong>square brackets</strong> in order of appearance, for example <code className="bg-stone-200 text-black px-1.5 py-0.5 rounded font-mono font-semibold text-xs">[1]</code>, <code className="bg-stone-200 text-black px-1.5 py-0.5 rounded font-mono font-semibold text-xs">[2]</code>, <code className="bg-stone-200 text-black px-1.5 py-0.5 rounded font-mono font-semibold text-xs">[3]</code>. The template also mentions author-date citations, such as <em>(Aggarwal, 2026)</em> or <em>Sodhi (2026)</em>, so authors should confirm with the organisers which style to follow.
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mt-0.5">
                12
              </span>
              <div className="text-sm text-black/85 leading-relaxed">
                The <strong>reference list</strong> must be set in <strong>9 pt font</strong>, <strong>left-aligned with a hanging indent</strong>, and every entry must strictly follow the <strong>Harvard referencing style</strong>.
              </div>
            </div>
          </div>
        </section>

        {/* Important Compliance Warning Card */}
        <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-6 shadow-md flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-700 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-serif font-bold text-base sm:text-lg text-red-900 mb-1">
              Important Compliance Notice
            </h4>
            <p className="text-sm text-red-800 leading-relaxed font-medium">
              Authors are strongly advised to review these guidelines carefully and ensure full
              compliance before submitting the final camera-ready paper. Submissions that do not
              follow the official conference guidelines and template may require revision or be
              rejected.
            </p>
          </div>
        </div>

        {/* Bottom Back Button */}
        <div className="pt-4 flex items-center justify-start">
          <button
            onClick={onBack}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-black text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all shadow-md cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Phase 2
          </button>
        </div>
      </div>
    </div>
  );
}
