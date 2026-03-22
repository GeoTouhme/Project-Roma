import { Link, useLocation } from "react-router-dom";
import Icons from "../svg";

const Breadcrumb = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  return (
    <nav className="text-gray-600 text-base">
      <ul className="flex items-center justify-center">
        <li>
          <Link to="/" className="text-primary hover:underline capitalize">
            Home
          </Link>
        </li>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;

          return (
            <li key={to} className="flex items-center">
              <span className="mx-2">
                <Icons name="right_arrow" width={12} height={12} color="#000000"/>
              </span>
              {isLast ? (
                <span className="text-black capitalize font-semibold">{value}</span>
              ) : (
                <Link to={to} className="text-primary hover:underline capitalize">
                  {value}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default Breadcrumb;
