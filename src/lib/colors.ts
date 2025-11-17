import { CategoryId } from './categories';

export const CATEGORY_COLORS: { [key in CategoryId]: string } = {
  'people_identity': '#FFCDD2', // Red 100
  'body_health': '#F8BBD0', // Pink 100
  'home_objects_daily': '#E1BEE7', // Purple 100
  'food_restaurant_shopping': '#D1C4E9', // Deep Purple 100
  'places_transport_travel': '#C5CAE9', // Indigo 100
  'nature_weather_environment': '#BBDEFB', // Light Blue 100
  'time_numbers_measure': '#B2EBF2', // Cyan 100
  'school_work_technology': '#B2DFDB', // Teal 100
  'feelings_thoughts_communication': '#C8E6C9', // Green 100
  'society_culture_hobbies': '#FFE0B2', // Orange 100
};

export const UNKNOWN_CATEGORY_COLOR = '#FFFFFF';

