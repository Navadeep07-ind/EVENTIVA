export interface InstitutionSummary {
  id: number;
  code: string;
  official_name: string;
  common_name?: string;
  abbreviations?: string;
  category: string;
  institution_type: string;
  state: string;
  district?: string;
  city: string;
  website?: string;
  established_year?: number;
  has_branding_kit: boolean;
  branding_kit_id?: number;
  branding_status?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  recognition_summary: string[];
}

export interface BrandingColorItem {
  type: string;
  hex: string;
  label?: string;
  source: 'officially_published' | 'ai_suggested' | 'user_provided' | 'unverified';
}

export interface BrandingDiscoveryResult {
  institution_id: number;
  institution_name: string;
  official_website?: string;
  candidate_logo_url?: string;
  candidate_badge_url?: string;
  candidate_backdrop_url?: string;
  extracted_colors: BrandingColorItem[];
  recommended_font: string;
  recommended_border: string;
  discovery_source: string;
  status: string;
  draft_kit: InstitutionKit;
}

export interface InstitutionKit {
  id: number | string;
  institution_id?: number;
  name: string;
  short_name?: string;
  institution_type: string;
  location?: string;
  department?: string;
  logo_url?: string;
  badge_url?: string;
  backdrop_url?: string;
  primary_color: string;
  secondary_color: string;
  dark_bg: string;
  accent_color: string;
  preferred_font: string;
  recommended_border: string;
  signoff_text?: string;
  website?: string;
  status?: string; // "Discovered" | "Identity Verified" | "Assets Collected" | "Assets Verified" | "Institution Confirmed"
  version?: number;
  is_verified: boolean;
  is_public?: boolean;
  user_id?: number | null;
}

export const PRESET_INSTITUTION_KITS: InstitutionKit[] = [
  {
    id: 1,
    name: "TKR College of Engineering and Technology",
    short_name: "TKRCET",
    institution_type: "Autonomous Engineering College",
    location: "Medbowli, Meerpet, Hyderabad, Telangana - 500097",
    department: "Department of Computer Science and Engineering",
    logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=tkrcet_shield_emblem",
    badge_url: "https://api.dicebear.com/7.x/identicon/svg?seed=naac_a_plus_tkrcet",
    backdrop_url: "",
    primary_color: "#0f2b5c",
    secondary_color: "#c59b27",
    dark_bg: "#050b18",
    accent_color: "#2563eb",
    preferred_font: "Cinzel",
    recommended_border: "academic-double-gold",
    signoff_text: "With Regards,\nDepartment of Computer Science and Engineering\nTKR College of Engineering and Technology",
    website: "https://www.tkrcet.ac.in",
    status: "Assets Verified",
    is_verified: true
  },
  {
    id: 2,
    name: "VNR Vignana Jyothi Institute of Engineering and Technology",
    short_name: "VNR VJIET",
    institution_type: "Autonomous Engineering College",
    location: "Vignana Jyothi Nagar, Pragathi Nagar, Nizampet, Hyderabad - 500090",
    department: "Department of Information Technology & CSE",
    logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=vnr_vjiet_crest",
    badge_url: "https://api.dicebear.com/7.x/identicon/svg?seed=naac_a_double_plus",
    backdrop_url: "",
    primary_color: "#1e3a8a",
    secondary_color: "#d97706",
    dark_bg: "#09142e",
    accent_color: "#38bdf8",
    preferred_font: "Inter",
    recommended_border: "academic-double-gold",
    signoff_text: "Cordially Invited by,\nOrganizing Committee, VNR Vignana Jyothi Institute of Engineering and Technology",
    website: "https://www.vnrvjiet.ac.in",
    status: "Assets Verified",
    is_verified: true
  },
  {
    id: 3,
    name: "Vignan's Foundation for Science, Technology and Research",
    short_name: "Vignan University",
    institution_type: "Deemed to be University",
    location: "Vadlamudi, Guntur, Andhra Pradesh - 522213",
    department: "School of Computing & Informatics",
    logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=vignan_university_insignia",
    badge_url: "https://api.dicebear.com/7.x/identicon/svg?seed=naac_a_plus_vignan",
    backdrop_url: "",
    primary_color: "#15803d",
    secondary_color: "#eab308",
    dark_bg: "#052e16",
    accent_color: "#22c55e",
    preferred_font: "Montserrat",
    recommended_border: "academic-double-gold",
    signoff_text: "With Warm Regards,\nFaculty & Student Organizing Committee\nVignan University",
    website: "https://www.vignan.ac.in",
    status: "Assets Verified",
    is_verified: true
  },
  {
    id: 4,
    name: "Chaitanya Bharathi Institute of Technology",
    short_name: "CBIT",
    institution_type: "Autonomous Engineering College",
    location: "Gandipet, Hyderabad, Telangana - 500075",
    department: "Department of Computer Science & Engineering",
    logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=cbit_hyderabad_seal",
    badge_url: "https://api.dicebear.com/7.x/identicon/svg?seed=naac_a_plus_cbit",
    backdrop_url: "",
    primary_color: "#065f46",
    secondary_color: "#ca8a04",
    dark_bg: "#022c22",
    accent_color: "#34d399",
    preferred_font: "Playfair Display",
    recommended_border: "classic-emerald-gold",
    signoff_text: "With Best Compliments,\nChaitanya Bharathi Institute of Technology\nGandipet, Hyderabad",
    website: "https://www.cbit.ac.in",
    status: "Assets Verified",
    is_verified: true
  },
  {
    id: 5,
    name: "Vasavi College of Engineering",
    short_name: "Vasavi College",
    institution_type: "Autonomous Engineering College",
    location: "9-5-81, Ibrahimbagh, Hyderabad - 500031",
    department: "Department of Information Technology",
    logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=vasavi_college_crest",
    badge_url: "https://api.dicebear.com/7.x/identicon/svg?seed=naac_a_plus_vce",
    backdrop_url: "",
    primary_color: "#1e3a8a",
    secondary_color: "#b45309",
    dark_bg: "#0a0e1a",
    accent_color: "#60a5fa",
    preferred_font: "Inter",
    recommended_border: "academic-double-gold",
    signoff_text: "Cordially Invited by,\nOrganizing Committee, Vasavi College of Engineering",
    website: "https://www.vce.ac.in",
    status: "Assets Verified",
    is_verified: true
  },
  {
    id: 6,
    name: "Indian Institute of Technology Hyderabad",
    short_name: "IIT Hyderabad",
    institution_type: "Institute of National Importance",
    location: "Near NH-65, Kandi, Sangareddy, Telangana - 502284",
    department: "Department of Computer Science & Engineering",
    logo_url: "https://api.dicebear.com/7.x/identicon/svg?seed=iith_official_emblem",
    badge_url: "",
    backdrop_url: "",
    primary_color: "#1d4ed8",
    secondary_color: "#f97316",
    dark_bg: "#030712",
    accent_color: "#06b6d4",
    preferred_font: "Orbitron",
    recommended_border: "futuristic-tech-brackets",
    signoff_text: "Organized by,\nTechnical Council & Students' Gymkhana\nIndian Institute of Technology Hyderabad",
    website: "https://www.iith.ac.in",
    status: "Assets Verified",
    is_verified: true
  }
];
