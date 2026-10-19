
import { useState } from 'react';
import { Building2, Users, Bell, CreditCard } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { colors, fontDisplay } from '../Components/ui/designSystem';
import Header from '../Components/Header';
const SETTINGS_SECTIONS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'billing', label: 'Billing', icon: CreditCard },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id'];

export default function SetiingPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('billing');
  const shouldReduceMotion = useReducedMotion();
  const sectionTitle = SETTINGS_SECTIONS.find(({ id }) => id === activeSection)?.label;

  return (

    <>
      <Header />
      <main className="min-h-screen px-5 py-5 sm:px-8 sm:py-7" style={{ backgroundColor: colors.paper }}>
        <h1
          className="mb-8 text-2xl font-semibold sm:mb-10 sm:text-[30px]"
          style={{ color: colors.ink, fontFamily: fontDisplay }}
        >
          Settings
        </h1>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-[240px_minmax(0,1fr)] md:gap-8">
          <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:flex-col md:gap-1">
            {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;

              return (
                <button
                  key={id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveSection(id)}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5145E5] md:w-full ${isActive ? 'bg-[#EEF1FF] text-[#5145E5]' : 'text-[#62636D] hover:bg-black/4'}`}
                >
                  <Icon size={20} strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </nav>

          <motion.section
            key={activeSection}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.22 }}
            className="min-h-64 rounded-xl border bg-white p-5 sm:p-7"
            style={{ borderColor: colors.line }}
            aria-labelledby="settings-section-title"
          >
            <h2 id="settings-section-title" className="mb-6 text-lg font-semibold" style={{ color: colors.ink }}>
              {sectionTitle}
            </h2>

            {activeSection === 'billing' ? (
              <>
                <div className="flex flex-col gap-5 rounded-xl border-2 border-[#CBD4FF] bg-[#F0F2FF] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: colors.ink }}>Pro Plan</h3>
                    <p className="mt-1 text-sm text-[#777984]">Unlimited projects · Up to 20 clients</p>
                  </div>
                  <p className="shrink-0 text-xl font-bold text-[#5145E5]">
                    $49<span className="text-sm font-medium">/mo</span>
                  </p>
                </div>
                <p className="mt-5 text-sm text-[#777984]">Next billing date: July 18, 2024</p>
              </>
            ) : (
              <p className="text-sm text-[#777984]">{sectionTitle} settings are not available yet.</p>
            )}
          </motion.section>
        </div>
      </main>
    </>
  );
}