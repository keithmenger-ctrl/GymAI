-- Demo data: "Vegas Elite Performance". Deterministic (fixed random seed), relative to today's date.
-- Logins (password for all: academyos-demo):
--   owner@vegaselite.test  keith@vegaselite.test  mike@vegaselite.test  sarah@vegaselite.test
--   parent1@vegaselite.test .. parent6@vegaselite.test

select setseed(0.42);

create or replace function pg_temp.seed_user(p_email text, p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    crypt('academyos-demo', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', p_name),
    now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now());
  insert into profiles (id, full_name, email) values (v_id, p_name, p_email);
  return v_id;
end $$;

do $$
declare
  v_org uuid; v_loc uuid; v_owner uuid;
  v_today date := current_date;
  v_monday date := date_trunc('week', current_date)::date;
  v_now timestamptz := now();
  -- ids
  sport_ids jsonb := '{}'; coach_ids uuid[]; coach_profiles uuid[];
  prog uuid[]; lvl uuid[] := array_fill(null::uuid, array[3,3]); -- prog[1..3], lvl[p][l]
  guardian_ids uuid[]; athlete_ids uuid[];
  at_ids uuid[]; -- assessment type ids
  plan_ids uuid[];
  r record; s record; i int; j int; k int; w int;
  v_sess uuid; v_item uuid; v_pid uuid; v_uid uuid; v_gid uuid; v_aid uuid;
  v_starts timestamptz; v_ends timestamptz; v_week int; v_plan text; v_drills jsonb;
  v_status text; v_x numeric; v_base numeric; v_when date[]; v_val numeric;
  v_pi int; v_li int;
  first_names text[] := array['Johnny','Marcus','Ethan','Liam','Noah','Mason','Caleb','Jaylen','Isaiah','Tyler',
    'Owen','Dylan','Aiden','Carter','Lucas','Elijah','Grayson','Hudson','Wyatt','Jaxon',
    'Brody','Micah','Landon','Gavin','Xavier','Cole','Diego','Mateo','Zoe','Ava'];
  last_names text[] := array['Alvarez','Brooks','Carter','Diaz','Ellison','Foster','Garcia','Hughes','Ito','Jackson',
    'Kim','Lopez','Mitchell','Nguyen','Ortiz','Patel','Quinn','Reyes','Sullivan','Thompson',
    'Underwood','Vasquez','Walker','Young','Zamora','Bennett'];
  gmap int[] := array[1,2,2,3,4,5,5,6,7,8,9,10,10,11,12,13,14,15,16,17,18,19,19,20,21,22,23,24,25,26];
  -- athlete idx -> program idx / level idx
  prog_of int[] := array[1,1,1,1,1,1,1, 1,1,1,1,1,1,1, 1,1,1, 2,2,2,2,2, 2,2,2,2, 3,3,3,3];
  lvl_of  int[] := array[1,1,1,1,1,1,1, 2,2,2,2,2,2,2, 3,3,3, 1,1,1,1,1, 2,2,2,2, 1,1,1,1];
  sports text[] := array['Baseball','Basketball','Football','Soccer','Track'];
  positions jsonb := '{"Baseball":["P","SS","CF","C","2B"],"Basketball":["PG","SG","SF"],"Football":["WR","DB","RB"],"Soccer":["MF","FW","D"],"Track":["Sprinter","Hurdler"]}';
  teams text[] := array['Bishop Gorman','Liberty HS','Coronado HS','Faith Lutheran','Desert Oasis','Green Valley','Foothill HS','Bonanza HS'];
  v_sport text; v_age int; v_first text; v_last text;
  disengaged int[] := array[5,12,21];
  overdue int[] := array[3,9,20];
  tpl record;
  note_bodies text[] := array[
    'Great first step off the line today. Staying low through the first three strides.',
    'Struggling with deceleration mechanics, hips shooting back. Add more landing drills.',
    'Big effort and a great attitude. Leading warm-ups for the group.',
    'Arm swing is cleaner. Keep working on posture during the drive phase.',
    'Left ankle a little tight, modified plyo volume. Monitor next session.',
    'Hit a new best on the falling starts. Confidence is up.',
    'Needs reminders to reset between reps. Working on focus.',
    'Change-of-direction footwork improving, plant foot is landing under the hip now.',
    'Late to session, missed warm-up. Talked to parent at pickup.',
    'Excellent competitive sprint, won 3 of 4 rounds.'];
  shareable_flags boolean[] := array[true,false,true,true,false,true,false,true,false,true];
begin
  -- ------------------------------------------------ org, location, sports
  insert into organizations (name) values ('Vegas Elite Performance') returning id into v_org;
  insert into locations (organization_id, name, address) values (v_org, 'Main Turf', '4100 W Sunset Rd, Las Vegas, NV') returning id into v_loc;
  for i in 1..array_length(sports, 1) loop
    insert into sports (organization_id, name) values (v_org, sports[i]) returning id into v_pid;
    sport_ids := sport_ids || jsonb_build_object(sports[i], v_pid);
  end loop;

  -- ------------------------------------------------ staff
  v_owner := pg_temp.seed_user('owner@vegaselite.test', 'Keith Owner');
  insert into user_roles (user_id, organization_id, role, can_view_finance) values (v_owner, v_org, 'owner', true);
  coach_profiles := array[pg_temp.seed_user('keith@vegaselite.test', 'Coach Keith'),
                          pg_temp.seed_user('mike@vegaselite.test', 'Coach Mike'),
                          pg_temp.seed_user('sarah@vegaselite.test', 'Coach Sarah')];
  for i in 1..3 loop
    insert into user_roles (user_id, organization_id, role) values (coach_profiles[i], v_org, 'coach');
    insert into coaches (organization_id, profile_id, name, email, bio)
    values (v_org, coach_profiles[i], (array['Coach Keith','Coach Mike','Coach Sarah'])[i],
            (array['keith','mike','sarah'])[i] || '@vegaselite.test',
            (array['Speed and acceleration specialist.','Baseball performance lead.','Youth athletic development coach.'])[i])
    returning id into v_pid;
    coach_ids := coach_ids || v_pid;
  end loop;

  -- ------------------------------------------------ programs, levels
  for i in 1..3 loop
    insert into programs (organization_id, name, description, sport_id)
    values (v_org, (array['Youth Speed Development','Baseball Performance','General Athletic Development'])[i],
            (array['Sprint mechanics, acceleration and change of direction for youth athletes.',
                   'Rotational power, arm care and speed for baseball players.',
                   'Movement literacy, strength and coordination for developing athletes.'])[i],
            case i when 2 then (sport_ids ->> 'Baseball')::uuid else null end)
    returning id into v_pid;
    prog[i] := v_pid;
    for j in 1..3 loop
      insert into program_levels (organization_id, program_id, name, sort_order, capacity)
      values (v_org, v_pid, 'Level ' || j, j,
              (array[[8,10,6],[6,8,6],[8,10,6]])[i][j])
      returning id into v_pid;
      lvl[i][j] := v_pid;
      v_pid := prog[i];
    end loop;
  end loop;

  -- ------------------------------------------------ curriculum (4 weeks per level)
  -- Youth Speed Level 1 in full detail
  insert into curriculum_items (organization_id, level_id, week_number, title, description, objectives, drills, cues, notes, video_url) values
   (v_org, lvl[1][1], 1, 'Acceleration Mechanics',
    'Teach the shin angle and forward lean that produce a powerful first 10 yards.',
    'Athlete holds a 45° body lean for the first 3 steps. Drives knees and arms, not the head.',
    '["Dynamic warm-up","Wall drill (3x10s)","Falling starts","10-yard accelerations x6","Competitive sprint"]',
    'Push the ground away. Shin angle forward. Arms drive back, elbows to hip.',
    'Film 2 reps per athlete from the side for review.', null),
   (v_org, lvl[1][1], 2, 'Deceleration',
    'Learn to absorb force and stop under control before adding speed.',
    'Athlete stops within 3 steps from a 10-yard run with hips low and chest over knees.',
    '["Dynamic warm-up","Landing mechanics","5-10-5 stick drill","Run-and-stop ladder","Reactive stop game"]',
    'Sit the hips back. Knees track over toes. Quiet feet on the stop.', null, null),
   (v_org, lvl[1][1], 3, 'Change of Direction',
    'Plant, cut and re-accelerate with the outside foot planting under the hip.',
    'Athlete completes a 45° cut without crossing the feet or standing tall.',
    '["Dynamic warm-up","Lateral shuffle to sprint","45° cut drill","Pro agility technique","Mirror game"]',
    'Plant outside foot. Drop the hips. Push off the plant, not the trail leg.', null, null),
   (v_org, lvl[1][1], 4, 'Acceleration Progression',
    'Combine acceleration with resisted and assisted work to build power.',
    'Athlete shows improved 10-yard time and consistent posture over 15 yards.',
    '["Dynamic warm-up","Sled marches","Resisted starts","Flying 10s","Relay races"]',
    'Stay tall through the finish. Keep the arms relaxed at max speed.', null, null);
  -- Everything else: program-themed weeks, level-flavored
  for i in 1..3 loop
    for j in 1..3 loop
      continue when i = 1 and j = 1;
      for w in 1..4 loop
        insert into curriculum_items (organization_id, level_id, week_number, title, description, objectives, drills, cues)
        values (v_org, lvl[i][j], w,
          (array[
            array['Acceleration Mechanics','Deceleration','Change of Direction','Acceleration Progression'],
            array['Rotational Power','Arm Care and Mobility','Baseball Speed','Lower-Body Strength'],
            array['Movement Foundations','Jump and Land','Coordination and Agility','Strength Basics']
          ])[i][w] || case j when 1 then '' when 2 then ' II' else ' III' end,
          (array['Foundational','Progressive','Advanced'])[j] || ' work on this week''s theme.',
          'Athlete demonstrates clean technique on ' || (array['low','moderate','high'])[j] || ' intensity reps.',
          (array[
            '["Dynamic warm-up","Technique drill","Progression drill","Speed rep","Game"]',
            '["Dynamic warm-up","Medicine ball series","Band arm care","Sprint mechanics","Finisher"]',
            '["Dynamic warm-up","Movement patterns","Jump progression","Agility ladder","Team game"]'
          ])[i]::jsonb,
          'Quality over quantity. Reset between reps.');
      end loop;
    end loop;
  end loop;

  -- ------------------------------------------------ guardians (first 6 get logins)
  for i in 1..26 loop
    v_uid := null;
    if i <= 6 then v_uid := pg_temp.seed_user('parent' || i || '@vegaselite.test', 'Parent ' || last_names[i]); end if;
    if v_uid is not null then insert into user_roles (user_id, organization_id, role) values (v_uid, v_org, 'parent'); end if;
    insert into guardians (organization_id, profile_id, name, email, phone)
    values (v_org, v_uid,
            (array['Maria','David','Jennifer','Chris','Ashley','Robert','Michelle','Daniel','Amanda','Kevin'])[1 + (i % 10)] || ' ' || last_names[i],
            case when i <= 6 then 'parent' || i || '@vegaselite.test' else lower(last_names[i]) || '.family@example.com' end,
            '702-555-' || lpad((1000 + i * 37)::text, 4, '0'))
    returning id into v_gid;
    guardian_ids := guardian_ids || v_gid;
  end loop;

  -- ------------------------------------------------ athletes
  for i in 1..30 loop
    v_pi := prog_of[i]; v_li := lvl_of[i];
    v_sport := case when v_pi = 2 then 'Baseball' else sports[1 + (i % 5)] end;
    v_age := 9 + (i * 7) % 9; -- 9..17
    v_last := last_names[gmap[i]];
    insert into athletes (organization_id, first_name, last_name, date_of_birth, sport_id, position, school_team,
                          status, join_date, notes, current_program_id, current_level_id)
    values (v_org, first_names[i], v_last, (v_today - (v_age * 365 + (i * 13) % 300)),
            (sport_ids ->> v_sport)::uuid,
            (positions -> v_sport) ->> (i % jsonb_array_length(positions -> v_sport)),
            teams[1 + (i % 8)],
            case when i = 30 then 'trial' when i = 29 then 'paused' when i = 28 then 'inactive' else 'active' end,
            case when i in (24, 26, 27, 30) then v_today - (i % 19 + 2)   -- new this month
                 else v_today - (60 + (i * 11) % 300) end,
            case i when 1 then 'Wants to make varsity next year. Parent is very engaged.'
                   when 5 then 'Missed several sessions, check in with parent.' else null end,
            prog[v_pi], lvl[v_pi][v_li])
    returning id into v_aid;
    athlete_ids := athlete_ids || v_aid;
    insert into athlete_guardians (organization_id, athlete_id, guardian_id) values (v_org, v_aid, guardian_ids[gmap[i]]);
    insert into athlete_progress_events (organization_id, athlete_id, kind, title, occurred_at)
    select v_org, v_aid, 'milestone', 'Joined Vegas Elite Performance', (join_date::timestamp + interval '12 hours') at time zone 'UTC' from athletes where id = v_aid;
  end loop;

  -- ------------------------------------------------ assessment types
  for r in select * from (values
      ('10 Yard Sprint','sec','lower','Speed'),
      ('Vertical Jump','in','higher','Power'),
      ('Broad Jump','in','higher','Power'),
      ('Pro Agility','sec','lower','Agility'),
      ('Bodyweight','lb','higher','Body'),
      ('Push-ups','reps','higher','Strength'),
      ('Pull-ups','reps','higher','Strength')) t(n,u,d,c) loop
    insert into assessment_types (organization_id, name, unit, direction, category, reassess_days)
    values (v_org, r.n, r.u, r.d, r.c, 60) returning id into v_pid;
    at_ids := at_ids || v_pid;
  end loop;

  -- ------------------------------------------------ sessions: 8 weeks back through next week
  for w in -8..1 loop
    for tpl in select * from (values
        (1,1,0,15,0),(1,1,2,15,0),(1,2,0,16,0),(1,2,2,16,0),(1,3,4,15,0),
        (2,1,1,17,0),(2,1,3,17,0),(2,2,1,18,0),(2,2,3,18,0),
        (3,1,1,15,30),(3,1,5,9,0)) t(p,l,dow,h,m) loop
      v_starts := ((v_monday + w * 7 + tpl.dow)::timestamp + make_interval(hours => tpl.h, mins => tpl.m))
                  at time zone 'America/Los_Angeles';
      v_ends := v_starts + interval '1 hour';
      v_week := ((w + 8) % 4) + 1;
      select id, drills, title into v_item, v_drills, v_plan from curriculum_items
        where level_id = lvl[tpl.p][tpl.l] and week_number = v_week;
      select string_agg(n || '. ' || d, E'\n' order by n) into v_plan
        from (select ord::int as n, d from jsonb_array_elements_text(v_drills) with ordinality as x(d, ord)) z;
      insert into sessions (organization_id, program_id, level_id, curriculum_item_id, location_id, coach_id,
                            starts_at, ends_at, max_athletes, session_plan, focus)
      values (v_org, prog[tpl.p], lvl[tpl.p][tpl.l], v_item, v_loc, coach_ids[tpl.p], v_starts, v_ends,
              (select capacity from program_levels where id = lvl[tpl.p][tpl.l]), v_plan,
              (select title from curriculum_items where id = v_item))
      returning id into v_sess;
      -- roster: active/trial athletes in that program level
      insert into session_athletes (organization_id, session_id, athlete_id)
      select v_org, v_sess, a.id from athletes a
      where a.current_level_id = lvl[tpl.p][tpl.l] and a.status in ('active', 'trial')
        and a.join_date <= v_starts::date;
      -- attendance for sessions already in the past (today's sessions are left open)
      if v_starts::date < v_today then
        insert into attendance (organization_id, session_id, athlete_id, status, marked_by, marked_at)
        select v_org, v_sess, sa.athlete_id,
               case
                 when idx = any (disengaged) and v_starts::date > v_today - 21 then 'absent'
                 when random() < 0.82 then 'present'
                 when random() < 0.45 then 'late'
                 else 'absent' end,
               coach_profiles[tpl.p], v_starts
        from (select sa2.athlete_id, array_position(athlete_ids, sa2.athlete_id) as idx
              from session_athletes sa2 where sa2.session_id = v_sess) sa;
        -- occasional coach note
        if random() < 0.5 then
          insert into coach_notes (organization_id, athlete_id, session_id, author_id, body, shareable, created_at)
          select v_org, sa.athlete_id, v_sess, coach_profiles[tpl.p],
                 note_bodies[1 + floor(random() * 10)::int], random() < 0.6, v_ends
          from session_athletes sa where sa.session_id = v_sess order by random() limit 1;
        end if;
        if random() < 0.35 then
          insert into coach_notes (organization_id, athlete_id, session_id, author_id, body, shareable, created_at)
          values (v_org, null, v_sess, coach_profiles[tpl.p], 'Good energy from the group. Focus was ' ||
                  (select title from curriculum_items where id = v_item) || '.', false, v_ends);
        end if;
      end if;
    end loop;
  end loop;

  -- ------------------------------------------------ assessment history (3 rounds; some athletes overdue)
  for i in 1..30 loop
    v_age := 9 + (i * 7) % 9;
    if i = any (overdue) then v_when := array[v_today - 95, v_today - 70];
    else v_when := array[v_today - 70, v_today - 35, v_today - 3]; end if;
    for k in 1..array_length(v_when, 1) loop
      -- k-th round: values improve each round
      insert into assessment_results (organization_id, athlete_id, type_id, value, recorded_on, recorded_by)
      values
        (v_org, athlete_ids[i], at_ids[1], round((2.35 - v_age * 0.03 - (k - 1) * 0.06 + (i % 5) * 0.01)::numeric, 2), v_when[k], coach_profiles[1]),
        (v_org, athlete_ids[i], at_ids[2], round((12 + v_age * 0.9 + (k - 1) * 1.2 + (i % 4))::numeric, 1), v_when[k], coach_profiles[1]),
        (v_org, athlete_ids[i], at_ids[3], round((40 + v_age * 3.2 + (k - 1) * 3 + (i % 6))::numeric, 0), v_when[k], coach_profiles[1]),
        (v_org, athlete_ids[i], at_ids[4], round((5.9 - v_age * 0.05 - (k - 1) * 0.08 + (i % 3) * 0.02)::numeric, 2), v_when[k], coach_profiles[1]);
      if k in (1, array_length(v_when, 1)) then
        insert into assessment_results (organization_id, athlete_id, type_id, value, recorded_on, recorded_by)
        values (v_org, athlete_ids[i], at_ids[6], 8 + v_age + (k - 1) * 3 + (i % 5), v_when[k], coach_profiles[1]);
      end if;
    end loop;
  end loop;

  -- ------------------------------------------------ level-change events for Level 2/3 athletes
  for i in 1..30 loop
    if lvl_of[i] > 1 then
      insert into athlete_progress_events (organization_id, athlete_id, kind, title, occurred_at)
      values (v_org, athlete_ids[i], 'level_change', 'Advanced to Level ' || lvl_of[i], ((v_today - (40 + i * 3))::timestamp + interval '12 hours') at time zone 'UTC');
    end if;
  end loop;

  -- ------------------------------------------------ memberships + payments
  insert into membership_plans (organization_id, name, price_cents, interval) values
    (v_org, 'Speed Development Monthly', 19900, 'month'),
    (v_org, 'Baseball Performance Monthly', 17900, 'month'),
    (v_org, 'General Athletic Development Monthly', 14900, 'month');
  select array_agg(id order by price_cents desc) into plan_ids from membership_plans where organization_id = v_org;
  -- order by price desc gives speed(199), baseball(179), gad(149)
  for i in 1..30 loop
    v_status := case when i in (6, 14, 23) then 'past_due'
                     when i = 30 then 'trialing'
                     when i = 28 then 'canceled'
                     else 'active' end;
    insert into memberships (organization_id, athlete_id, guardian_id, plan_id, status, next_billing_date)
    values (v_org, athlete_ids[i], guardian_ids[gmap[i]], plan_ids[prog_of[i]], v_status,
            case when v_status in ('active', 'past_due', 'trialing')
                 then (date_trunc('month', v_today) + interval '1 month' + ((i % 28) || ' days')::interval)::date
                 else null end)
    returning id into v_pid;
    if v_status <> 'trialing' then
      for k in 1..3 loop
        insert into payments (organization_id, membership_id, amount_cents, status, paid_at)
        values (v_org, v_pid, (select price_cents from membership_plans where id = plan_ids[prog_of[i]]),
                case when k = 1 and v_status = 'past_due' then 'failed' else 'paid' end,
                case when k = 1 and v_status = 'past_due' then null else v_now - ((k - 1) * 30 || ' days')::interval end);
      end loop;
    end if;
  end loop;
end $$;
