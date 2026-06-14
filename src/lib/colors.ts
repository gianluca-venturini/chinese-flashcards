import { CategoryId } from './categories';

export const CATEGORY_COLORS: { [key in CategoryId]: string } = {
  'people_identity': '#FECACA', // Tailwind red-200
  'body_health': '#FBCFE8', // Tailwind pink-200
  'home_objects_daily': '#E9D5FF', // Tailwind purple-200
  'food_restaurant_shopping': '#FED7AA', // Tailwind orange-200
  'places_transport_travel': '#BFDBFE', // Tailwind blue-200
  'nature_weather_environment': '#A7F3D0', // Tailwind emerald-200
  'time_numbers_measure': '#FDE68A', // Tailwind amber-200
  'school_work_technology': '#A5F3FC', // Tailwind cyan-200
  'feelings_thoughts_communication': '#D9F99D', // Tailwind lime-200
  'society_culture_hobbies': '#F5D0FE', // Tailwind fuchsia-200
};

export const UNKNOWN_CATEGORY_COLOR = '#FFFFFF';

