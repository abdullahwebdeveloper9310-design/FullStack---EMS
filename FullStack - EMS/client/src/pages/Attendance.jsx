import { useCallback, useEffect, useState } from "react";
import { dummyAttendanceData } from "../assets/assets";
import Loading from "../components/Loading";
import CheckInButton from "../components/attendances/CheckInButton";
import AttendanceStats from "../components/attendances/AttendanceStats";
import AttendanceHistory from "../components/attendances/AttendanceHistory";
import api from "../../api/axios";
import toast from "react-hot-toast";

const Attendance = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/attendance");
      const json = res.data;
      setHistory(json.data || []);
      if (json.employee?.isDeleted) setIsDeleted(true);
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <Loading />;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayRecord = history.find(
    (r) => new Date(r.date).toDateString() === today.toDateString(),
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Attendances</h1>
        <p className="page-subtitle">
          Track Your Work Hours And Daily Check-In
        </p>
      </div>

      {isDeleted ? (
        <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center">
          <p className="text-rose-600">
            You Can No Longer Clock In Or Clock Out Because Your Employees
            Record Have Been Marked As Deleted
          </p>
        </div>
      ) : (
        <div className="mb-8">
          <button>
            <CheckInButton todayRecord={todayRecord} onAction={fetchData} />
          </button>
        </div>
      )}

      <AttendanceStats history={history} />
      <AttendanceHistory history={history} />
    </div>
  );
};

export default Attendance;
