import Gallery from '@/components/Gallery';
import { getLiteItems } from '@/lib/items';

export default function Home() {
  return <Gallery items={getLiteItems()} />;
}
